import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  ZRestoreAction,
  ZRestoreCheckEmpty,
  ZRestoreFolder,
  ZRestoreItem,
  ZRestoreList,
  ZRestoreMultiple,
  type ZRestoreResultType,
  ZRestoreSingle,
  ZRestoreTask,
} from "@blinkdisk/schemas/restore";
import { restorePathExists, validateRestorePath } from "@electron/restore-path";
import { fetchVault } from "@electron/vault/fetch";
import { getVault } from "@electron/vault/manage";
import type { VaultInstance } from "@electron/vault/types";
import { window } from "@electron/window";
import { app, dialog } from "electron";
import { z } from "zod";

type Operation = {
  result: ZRestoreResultType;
  vault: VaultInstance;
  taskId?: string;
  canceled: boolean;
  writeStarted: boolean;
  completed: number;
};
const operations = new Map<string, Operation>();
const destinations = new Set<string>();

export function hasActiveRestores() {
  return (
    destinations.size > 0 ||
    [...operations.values()].some(
      ({ result }) =>
        result.status === "RUNNING" || result.status === "CANCELING",
    )
  );
}

export function splitFileName(name: string) {
  const parts = name.split(".");
  return parts.length > 1
    ? { baseName: parts.slice(0, -1).join("."), extension: parts.at(-1) || "" }
    : { baseName: name, extension: "" };
}
export function generateDuplicateName(
  baseName: string,
  extension: string,
  counter: number,
) {
  return `${baseName} (${counter})${extension ? `.${extension}` : ""}`;
}

function start(
  vaultId: string,
  sourceId: string,
  destination: string,
  objects: string[],
  work: (operation: Operation) => Promise<void>,
) {
  const vault = getVault(vaultId);
  if (!vault) throw new Error("VAULT_NOT_FOUND");
  if (operations.size >= 1000)
    throw new Error(
      "Dismiss old restore results before starting another restore",
    );
  const operation: Operation = {
    vault,
    canceled: false,
    writeStarted: false,
    completed: 0,
    result: {
      id: randomUUID(),
      sourceId,
      destination,
      objects,
      status: "RUNNING",
      progress: 0,
      restored: 0,
      skipped: 0,
      errors: 0,
    },
  };
  operations.set(operation.result.id, operation);
  let destinationKey = resolve(destination);
  if (process.platform === "win32")
    destinationKey = destinationKey.toLowerCase();
  const overlapping = [...destinations].some(
    (path) =>
      path === destinationKey ||
      path.startsWith(destinationKey + sep) ||
      destinationKey.startsWith(path + sep),
  );
  if (overlapping) {
    operation.result.status = "FAILED";
    operation.result.issue = "DESTINATION";
    return true;
  }
  destinations.add(destinationKey);
  void work(operation)
    .then(() => {
      if (
        operation.result.status === "RUNNING" ||
        operation.result.status === "CANCELING"
      ) {
        operation.result.status =
          operation.canceled && operation.completed < objects.length
            ? "CANCELED"
            : operation.result.errors || operation.result.skipped
              ? "PARTIAL"
              : "COMPLETE";
        if (operation.result.status === "COMPLETE")
          operation.result.progress = 1;
        if (operation.result.issue === "ZIP")
          operation.result.restored = Math.max(
            0,
            operation.result.restored - operation.result.skipped,
          );
      }
    })
    .catch((error: unknown) => {
      const code = error instanceof Error ? error.message : "DESTINATION";
      operation.result.issue =
        code === "LINK" ||
        code === "CONFIRMATION" ||
        code === "TIMEOUT" ||
        code === "ENGINE" ||
        code === "TASK" ||
        code === "SPACE" ||
        code === "PERMISSION"
          ? code
          : "DESTINATION";
      operation.result.status =
        code === "ENGINE" || code === "TIMEOUT" ? "UNAVAILABLE" : "FAILED";
    })
    .finally(() => {
      const engine = operation.vault.server?.process;
      if (
        operation.writeStarted &&
        engine &&
        engine.exitCode === null &&
        engine.signalCode === null
      ) {
        // An unavailable result is not evidence that native writing stopped.
        // Keep overlapping destinations reserved until this engine exits.
        engine.once("exit", () => destinations.delete(destinationKey));
      } else destinations.delete(destinationKey);
    });
  return true;
}

async function taskRequest(
  operation: Operation,
  method: "GET" | "POST",
  path: string,
  data?: object,
) {
  try {
    return await fetchVault(operation.vault, {
      method,
      path,
      data,
      timeoutMs: 15000,
    });
  } catch {
    throw new Error("ENGINE");
  }
}

function taskFailure(message?: string) {
  if (/no space|disk.*full|not enough space|ENOSPC/i.test(message ?? ""))
    return new Error("SPACE");
  if (
    /permission denied|access (?:is )?denied|EPERM|EACCES/i.test(message ?? "")
  )
    return new Error("PERMISSION");
  return new Error("TASK");
}

async function runTask(operation: Operation, root: string, output: object) {
  if (operation.canceled) return false;
  operation.writeStarted = true;
  const response = await taskRequest(operation, "POST", "/api/v1/restore", {
    root,
    options: {
      incremental: false,
      ignoreErrors: false,
      restoreDirEntryAtDepth: 1000000,
      minSizeForPlaceholder: -1,
    },
    ...output,
  });
  const started = ZRestoreTask.safeParse(response);
  if (!started.success) {
    const error = z.object({ error: z.string() }).safeParse(response);
    if (error.success) {
      operation.writeStarted = false;
      throw taskFailure(error.data.error);
    }
    throw new Error("ENGINE");
  }
  operation.taskId = started.data.id;
  const deadline = Date.now() + 24 * 60 * 60 * 1000;
  let cancelDeadline: number | undefined;
  let sentCancel = false;
  while (true) {
    if (operation.canceled && !sentCancel) {
      await taskRequest(
        operation,
        "POST",
        `/api/v1/tasks/${operation.taskId}/cancel`,
      );
      sentCancel = true;
      cancelDeadline = Date.now() + 30000;
    }
    const parsed = ZRestoreTask.safeParse(
      await taskRequest(operation, "GET", `/api/v1/tasks/${operation.taskId}`),
    );
    if (!parsed.success || parsed.data.id !== operation.taskId)
      throw new Error("ENGINE");
    const task = parsed.data;
    if (task.status === "CANCELING") operation.result.status = "CANCELING";
    if (task.status !== "RUNNING" && task.status !== "CANCELING") {
      operation.writeStarted = false;
      const count = (key: string) => task.counters?.[key]?.value ?? 0;
      operation.result.restored +=
        count("Restored Files") +
        count("Restored Directories") +
        count("Restored Symlinks");
      operation.result.errors += count("Ignored Errors");
      operation.result.skipped += count("Skipped Files");
      operation.taskId = undefined;
      if (task.status === "CANCELED") {
        operation.canceled = true;
        operation.result.status = "CANCELED";
      } else if (task.status === "FAILED" || task.errorMessage)
        throw taskFailure(task.errorMessage);
      else if (
        [
          "Restored Files",
          "Restored Directories",
          "Restored Symlinks",
          "Ignored Errors",
          "Skipped Files",
        ].some((key) => !task.counters?.[key])
      )
        throw new Error("ENGINE");
      return task.status === "SUCCESS";
    }
    if (Date.now() >= (cancelDeadline ?? deadline)) {
      if (!sentCancel)
        await taskRequest(
          operation,
          "POST",
          `/api/v1/tasks/${operation.taskId}/cancel`,
        );
      throw new Error("TIMEOUT");
    }
    await delay(250);
  }
}

function fsOutput(targetPath: string, overwrite: boolean) {
  return {
    fsOutput: {
      targetPath,
      ignorePermissionErrors: false,
      overwriteFiles: overwrite,
      overwriteDirectories: overwrite,
      overwriteSymlinks: overwrite,
      writeFilesAtomically: true,
      flushFiles: true,
    },
  };
}

// Validate snapshot names before giving a recursive tree to the native writer.
// Directory objects are immutable; do not follow snapshot symlinks as directories.
type ExpectedOutput = { path: string; type: "f" | "d" | "s"; size?: number };
const ZDirectoryEntries = z.object({
  entries: z
    .array(
      z.object({
        name: ZRestoreItem.shape.name,
        obj: z.string().min(1),
        type: z.enum(["f", "d", "s"]),
        size: z.number().nonnegative().optional(),
      }),
    )
    .nullable(),
});

async function validateSelectedEntry(
  operation: Operation,
  item: z.infer<typeof ZRestoreItem>,
) {
  if (item.snapshotId) {
    const response = z
      .object({
        snapshots: z.array(
          z.object({
            id: z.string(),
            rootID: z.string(),
            rootEntryType: z.enum(["f", "d", "s"]).optional(),
          }),
        ),
      })
      .safeParse(
        await taskRequest(operation, "GET", "/api/v1/snapshots?all=1"),
      );
    if (!response.success) throw new Error("TASK");
    const snapshot = response.data.snapshots.find(
      (snapshot) => snapshot.id === item.snapshotId,
    );
    const expectedType =
      item.type === "FILE" ? "f" : item.type === "SYMLINK" ? "s" : "d";
    if (
      !snapshot ||
      snapshot.rootID !== item.objectId ||
      snapshot.rootEntryType !== expectedType ||
      item.entryPath
    )
      throw new Error("TASK");
    return { size: undefined };
  }
  const suffix = `/${item.name}`;
  if (!item.entryPath?.endsWith(suffix)) throw new Error("TASK");
  const parent = item.entryPath.slice(0, -suffix.length);
  if (!parent || /[\\/]/.test(parent)) throw new Error("TASK");
  const listing = ZDirectoryEntries.safeParse(
    await taskRequest(
      operation,
      "GET",
      `/api/v1/objects/${encodeURIComponent(parent)}`,
    ),
  );
  if (!listing.success) throw new Error("TASK");
  const entry = listing.data.entries?.find((entry) => entry.name === item.name);
  const type =
    item.type === "DIRECTORY" ? "d" : item.type === "FILE" ? "f" : "s";
  if (!entry || entry.obj !== item.objectId || entry.type !== type)
    throw new Error("TASK");
  return entry;
}
async function validateSnapshot(
  operation: Operation,
  root: string,
  zip = false,
) {
  const pending = [{ object: root, path: "" }];
  const expected: ExpectedOutput[] = [{ path: "", type: "d" }];
  let visited = 0;
  while (pending.length) {
    if (operation.canceled) return expected;
    const current = pending.pop();
    if (!current) continue;
    const { object } = current;
    if (++visited > 1000000) throw new Error("TASK");
    const parsed = ZDirectoryEntries.safeParse(
      await taskRequest(
        operation,
        "GET",
        `/api/v1/objects/${encodeURIComponent(object)}`,
      ),
    );
    if (!parsed.success) throw new Error("TASK");
    // The pinned ZIP writer omits empty directories and symbolic links.
    if (zip && !parsed.data.entries?.length) operation.result.skipped++;
    const names = new Set<string>();
    for (const entry of parsed.data.entries ?? []) {
      const name =
        process.platform === "win32" ? entry.name.toLowerCase() : entry.name;
      if (names.has(name)) throw new Error("TASK");
      names.add(name);
      const path = join(current.path, entry.name);
      expected.push({
        path,
        type: entry.type,
        size: entry.type === "f" ? (entry.size ?? 0) : undefined,
      });
      if (expected.length > 1000000) throw new Error("TASK");
      if (entry.type === "d") pending.push({ object: entry.obj, path });
      if (zip && entry.type === "s") operation.result.skipped++;
    }
  }
  if (zip && operation.result.skipped) operation.result.issue = "ZIP";
  return expected;
}

async function verifyOutput(
  operation: Operation,
  destination: string,
  expected: ExpectedOutput[],
) {
  if (operation.result.skipped || operation.result.errors) return;
  for (const entry of expected) {
    const stat = await restorePathExists(join(destination, entry.path));
    if (
      !stat ||
      (entry.type === "d" && !stat.isDirectory()) ||
      (entry.type === "s" && !stat.isSymbolicLink()) ||
      (entry.type === "f" &&
        (!stat.isFile() ||
          (entry.size !== undefined && stat.size !== entry.size)))
    )
      throw new Error("DESTINATION");
  }
}

export async function restoreSingle(payload: z.infer<typeof ZRestoreSingle>) {
  const { item, ...context } = ZRestoreSingle.parse(payload);
  return restoreMultiple({ ...context, items: [item] });
}

export async function restoreMultiple(
  payload: z.infer<typeof ZRestoreMultiple>,
) {
  const { vaultId, sourceId, items, dialogTitle } =
    ZRestoreMultiple.parse(payload);
  if (!window) throw new Error("WINDOW_NOT_INITIALIZED");
  const picked = await dialog.showOpenDialog(window, {
    title: dialogTitle,
    defaultPath: app.getPath("downloads"),
    properties: ["openDirectory"],
  });
  const destination = picked.filePaths[0];
  if (picked.canceled || !destination) return false;
  return start(
    vaultId,
    sourceId,
    destination,
    items.map((item) => item.snapshotId ?? item.entryPath ?? item.objectId),
    async (operation) => {
      await validateRestorePath(destination);
      if (!(await restorePathExists(destination))?.isDirectory())
        throw new Error("DESTINATION");
      for (const [index, item] of items.entries()) {
        if (operation.canceled) break;
        const entry = await validateSelectedEntry(operation, item);
        let path = join(destination, item.name);
        const { baseName, extension } = splitFileName(item.name);
        for (let counter = 1; await restorePathExists(path); counter++) {
          if (counter > 10000) throw new Error("DESTINATION");
          path = join(
            destination,
            generateDuplicateName(baseName, extension, counter),
          );
        }
        await validateRestorePath(path);
        const expected: ExpectedOutput[] =
          item.type === "DIRECTORY"
            ? await validateSnapshot(operation, item.objectId)
            : [
                {
                  path: "",
                  type: item.type === "FILE" ? "f" : "s",
                  size:
                    item.type === "FILE" && item.entryPath
                      ? (entry.size ?? 0)
                      : undefined,
                },
              ];
        if (item.type === "SYMLINK" && !item.entryPath && !item.snapshotId)
          throw new Error("TASK");
        const completed = await runTask(
          operation,
          item.snapshotId ?? item.entryPath ?? item.objectId,
          fsOutput(path, false),
        );
        if (completed) {
          await verifyOutput(operation, path, expected);
          operation.completed++;
        }
        operation.result.progress = Math.min(0.99, (index + 1) / items.length);
      }
    },
  );
}

export async function restoreDirectory(
  payload: z.infer<typeof ZRestoreFolder>,
) {
  const { vaultId, sourceId, objectId, options } =
    ZRestoreFolder.parse(payload);
  const destination =
    options.type === "UNPACKED"
      ? options.directoryPath
      : dirname(options.filePath);
  return start(
    vaultId,
    sourceId,
    destination,
    [objectId],
    async (operation) => {
      await validateRestorePath(destination, options.type === "UNPACKED");
      if (!(await restorePathExists(destination))?.isDirectory())
        throw new Error("DESTINATION");
      const expected = await validateSnapshot(
        operation,
        objectId,
        options.type === "ZIP",
      );
      if (options.type === "UNPACKED") {
        if ((await readdir(destination)).length && !options.confirmed)
          throw new Error("CONFIRMATION");
        if (await runTask(operation, objectId, fsOutput(destination, true))) {
          await verifyOutput(operation, destination, expected);
          operation.completed++;
        }
      } else {
        await validateRestorePath(options.filePath);
        const existing = await restorePathExists(options.filePath);
        if (existing && (!existing.isFile() || existing.nlink > 1))
          throw new Error("LINK");
        const completed = await runTask(operation, objectId, {
          zipFile: options.filePath,
          uncompressedZip: !options.compress,
        });
        if (completed) {
          const output = await restorePathExists(options.filePath);
          if (!output?.isFile() || output.size < 22)
            throw new Error("DESTINATION");
          operation.completed++;
        }
      }
    },
  );
}

export async function checkEmpty(payload: z.infer<typeof ZRestoreCheckEmpty>) {
  const { directoryPath } = ZRestoreCheckEmpty.parse(payload);
  await validateRestorePath(directoryPath);
  return (await readdir(directoryPath)).length === 0;
}
export async function listRestores(payload: z.infer<typeof ZRestoreList>) {
  const { sourceId } = ZRestoreList.parse(payload);
  return [...operations.values()]
    .filter((operation) => operation.result.sourceId === sourceId)
    .map((operation) => ({ ...operation.result }));
}
export async function cancelRestore(payload: z.infer<typeof ZRestoreAction>) {
  const operation = operations.get(ZRestoreAction.parse(payload).id);
  if (operation?.result.status !== "RUNNING") return;
  operation.canceled = true;
  operation.result.status = "CANCELING";
}
export async function dismissRestore(payload: z.infer<typeof ZRestoreAction>) {
  const { id } = ZRestoreAction.parse(payload);
  const operation = operations.get(id);
  if (
    operation &&
    operation.result.status !== "RUNNING" &&
    operation.result.status !== "CANCELING"
  )
    operations.delete(id);
}
