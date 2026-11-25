import { opendir, realpath } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import type {
  BackupFolder,
  ZBackupFolderLookup,
  ZStartFolderBackups,
} from "@diskpond/schemas/source";
import { getHostName, getUserName } from "@electron/profile";
import { getConnection } from "@electron/vault/connection";
import { fetchVault } from "@electron/vault/fetch";
import { getVault } from "@electron/vault/manage";
import { app } from "electron";
import { z } from "zod";

const knownFolders = [
  "documents",
  "pictures",
  "desktop",
  "downloads",
  "music",
  "videos",
] as const;

function pathKey(path: string) {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function contains(parent: string, child: string) {
  const rest = relative(parent, child);
  return !isAbsolute(rest) && rest !== ".." && !rest.startsWith(`..${sep}`);
}

async function folderContext(vaultId: string) {
  const vault = getVault(vaultId);
  const connection = getConnection(vaultId);
  if (!connection) throw new Error("Vault connection unavailable");
  const destination =
    connection.type === "filesystem"
      ? await realpath(z.string().parse(connection.config.path))
      : undefined;
  const { sources } = z
    .object({
      sources: z.array(z.object({ source: z.object({ path: z.string() }) })),
    })
    .parse(
      await fetchVault(vault, {
        method: "GET",
        path: "/api/v1/sources",
        search: { host: getHostName(vaultId), userName: getUserName(vaultId) },
      }),
    );
  return {
    vault,
    destination,
    existing: new Set(sources.map(({ source }) => pathKey(source.path))),
  };
}

async function eligiblePath(path: string, destination?: string) {
  if (!isAbsolute(path)) return;
  const resolved = await realpath(path);
  if (
    destination &&
    (contains(resolved, destination) || contains(destination, resolved))
  )
    return;
  // Opening the directory checks list access without walking its contents.
  const directory = await opendir(resolved);
  await directory.close();
  return resolved;
}

export async function getBackupFolders({
  vaultId,
  path,
}: z.infer<typeof ZBackupFolderLookup>) {
  const { destination, existing } = await folderContext(vaultId);
  const home = path ? undefined : pathKey(await realpath(app.getPath("home")));
  const kinds = path ? (["custom"] as const) : knownFolders;
  const folders = await Promise.all(
    kinds.map(async (kind): Promise<BackupFolder | undefined> => {
      try {
        const location = kind === "custom" ? path : app.getPath(kind);
        if (!location) return;
        const resolved = await eligiblePath(location, destination);
        if (!resolved) return;
        const key = pathKey(resolved);
        // A disabled XDG user directory may point to the entire home directory.
        if (
          kind !== "custom" &&
          (key === home || dirname(resolved) === resolved)
        )
          return;
        // Keep the OS spelling on screen (including mapped drives). The key
        // identifies the actual directory the user reviewed.
        const displayPath = resolve(location);
        return {
          kind,
          path: displayPath,
          key,
          name: basename(displayPath) || displayPath,
          alreadyAdded: existing.has(key) || existing.has(pathKey(displayPath)),
        };
      } catch {
        // A missing or unmounted known folder doesn't hide the remaining choices.
        return;
      }
    }),
  );
  const unique = new Map<string, BackupFolder>();
  for (const folder of folders)
    if (folder && !unique.has(folder.key)) unique.set(folder.key, folder);
  return [...unique.values()];
}

export async function startFolderBackups({
  vaultId,
  folders,
}: z.infer<typeof ZStartFolderBackups>) {
  const { vault, destination, existing } = await folderContext(vaultId);
  const failed: string[] = [];
  for (const { path, key, name } of folders) {
    try {
      const resolved = await eligiblePath(path, destination);
      if (!resolved || pathKey(resolved) !== key)
        throw new Error("Folder changed");
      // Creating an existing source replaces its policy. Leave those sources alone,
      // including ones that succeeded in a previous, partially completed batch.
      if (existing.has(key) || existing.has(pathKey(path))) continue;
      z.object({ snapshotted: z.literal(true) }).parse(
        await fetchVault(vault, {
          method: "POST",
          path: "/api/v1/sources",
          data: {
            path: resolved,
            createSnapshot: true,
            policy: { name, initialSourceType: "directory" },
          },
        }),
      );
      existing.add(key);
    } catch {
      failed.push(path);
    }
  }
  return { failed };
}
