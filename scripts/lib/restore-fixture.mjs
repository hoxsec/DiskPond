import "../../apps/electron/src/identity.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  statfs,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app, dialog } from "electron";
import { globalConfigDirectory } from "../../apps/electron/src/path.ts";
import {
  cancelRestore,
  dismissRestore,
  listRestores,
  restoreDirectory,
  restoreMultiple,
  restoreSingle,
} from "../../apps/electron/src/restore.ts";
import { fetchVault } from "../../apps/electron/src/vault/fetch.ts";
import {
  createVault,
  stopAllVaults,
  vaults,
} from "../../apps/electron/src/vault/manage.ts";
import { startVaultServer } from "../../apps/electron/src/vault/server.ts";
import { createWindow } from "../../apps/electron/src/window.ts";
import { DEFAULT_VAULT_OPTIONS } from "../../libs/constants/src/vault.ts";

const directory = globalConfigDirectory();
const vaultId = "vlt_restore_fixture";
let finished = false;
const watchdog = setTimeout(
  () => finish(new Error("Restore fixture timeout")),
  160000,
);
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  stopAllVaults();
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
}
process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);
async function wait(check) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error("Timed out waiting for restore result");
}
async function request(method, path, data) {
  const result = await fetchVault(vaults[vaultId], {
    method,
    path: `/api/v1/${path}`,
    data,
  });
  assert.ok(!result.error && !result.code, JSON.stringify(result));
  return result;
}
async function hashes(path, prefix = "") {
  const result = {};
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const key = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      result[`${key}/`] = "directory";
      Object.assign(result, await hashes(join(path, entry.name), `${key}/`));
    } else
      result[key] = createHash("sha256")
        .update(await readFile(join(path, entry.name)))
        .digest("hex");
  }
  return result;
}
async function run(label, objectId, options, expected, afterStart) {
  assert.equal(
    await restoreDirectory({ vaultId, sourceId: label, objectId, options }),
    true,
  );
  const [started] = await listRestores({ sourceId: label });
  if (afterStart) await afterStart(started);
  const result = await wait(async () => {
    const [current] = await listRestores({ sourceId: label });
    return ["RUNNING", "CANCELING"].includes(current.status) ? null : current;
  });
  if (result.status !== expected) {
    console.info(
      "Fixture task diagnostics:",
      JSON.stringify(await request("GET", "tasks")),
    );
    console.info(
      "Fixture object diagnostics:",
      JSON.stringify(await request("GET", `objects/${objectId}`)),
    );
  }
  assert.equal(result.status, expected, JSON.stringify(result));
  if (expected !== "COMPLETE") assert.ok(result.progress < 1);
  assert.equal((await listRestores({ sourceId: label }))[0].status, expected);
  await dismissRestore({ id: result.id });
  assert.equal((await listRestores({ sourceId: label })).length, 0);
  console.info(`Restore fixture: ${label} -> ${result.status}`);
  return result;
}
void app.whenReady().then(async () => {
  try {
    const repository = join(directory, "repository");
    await mkdir(repository);
    const created = await createVault({
      vault: {
        id: vaultId,
        name: "Restore fixture",
        provider: "INTERNAL_DRIVE",
        config: { path: repository },
        password: "fixture-only",
        options: DEFAULT_VAULT_OPTIONS,
      },
      userPolicy: {},
      globalPolicy: {},
    });
    assert.ok(!created.error, JSON.stringify(created));
    const source = join(directory, "source");
    await mkdir(join(source, "nested", "空"), { recursive: true });
    await writeFile(join(source, "empty.txt"), "");
    await writeFile(
      join(source, "nested", "雪.txt"),
      "Unicode recovery fixture",
    );
    await writeFile(
      join(source, "large.bin"),
      process.env.DISKPOND_FULL_VOLUME
        ? randomBytes(32 * 1024 * 1024)
        : Buffer.alloc(32 * 1024 * 1024, 73),
    );
    const expected = await hashes(source);
    await request("POST", "sources", {
      path: source,
      policy: { scheduling: { manual: true } },
      createSnapshot: true,
    });
    const snapshot = await wait(
      async () => (await request("GET", "snapshots")).snapshots[0],
    );
    assert.ok(!snapshot.incomplete);
    const objectId = snapshot.rootID;
    const output = join(directory, "output");
    await mkdir(output);
    await run(
      "success",
      objectId,
      { type: "UNPACKED", directoryPath: output, confirmed: false },
      "COMPLETE",
    );
    assert.deepEqual(await hashes(output), expected);
    if (process.env.DISKPOND_FULL_VOLUME) {
      const volume = process.env.DISKPOND_FULL_VOLUME;
      const volumeStats = await statfs(volume);
      assert(volumeStats.blocks * volumeStats.bsize <= 128 * 1024 * 1024);
      assert(volumeStats.bavail * volumeStats.bsize < 2 * 1024 * 1024);
      assert.equal(
        await readFile(join(volume, "diskpond-fixture.txt"), "utf8"),
        "Disposable DiskPond full-volume fixture",
      );
      for (const mode of ["UNPACKED", "ZIP", "ZIP_COMPRESSED"]) {
        const destination = join(volume, "output");
        await mkdir(destination);
        try {
          const result = await run(
            `full-volume-${mode}`,
            objectId,
            mode === "UNPACKED"
              ? {
                  type: "UNPACKED",
                  directoryPath: destination,
                  confirmed: false,
                }
              : {
                  type: "ZIP",
                  filePath: join(destination, "restore.zip"),
                  compress: mode === "ZIP_COMPRESSED",
                },
            "FAILED",
          );
          assert.equal(result.issue, "SPACE", JSON.stringify(result));
        } finally {
          await rm(destination, { recursive: true, force: true });
        }
      }
    }
    await writeFile(join(output, "empty.txt"), "conflicting content");
    await run(
      "confirmation",
      objectId,
      { type: "UNPACKED", directoryPath: output, confirmed: false },
      "FAILED",
    );
    await run(
      "overwrite",
      objectId,
      { type: "UNPACKED", directoryPath: output, confirmed: true },
      "COMPLETE",
    );
    assert.deepEqual(await hashes(output), expected);
    process.env.DESKTOP_URL = "about:blank";
    const window = createWindow();
    window.hide();
    window.webContents.closeDevTools();
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [output],
    });
    const listing = await request("GET", `objects/${objectId}`);
    const file = listing.entries.find((entry) => entry.name === "large.bin");
    await restoreMultiple({
      vaultId,
      sourceId: "selected",
      dialogTitle: "Fixture",
      items: [1, 2].map(() => ({
        name: file.name,
        objectId: file.obj,
        entryPath: `${objectId}/${file.name}`,
        type: "FILE",
      })),
    });
    const selected = await wait(async () => {
      const [result] = await listRestores({ sourceId: "selected" });
      return result.status !== "RUNNING" ? result : null;
    });
    assert.equal(selected.status, "COMPLETE", JSON.stringify(selected));
    for (const name of ["large.bin", "large (1).bin", "large (2).bin"]) {
      assert.equal(
        createHash("sha256")
          .update(await readFile(join(output, name)))
          .digest("hex"),
        expected["large.bin"],
      );
    }
    console.info(
      "Restore fixture: selected duplicate names preserve keep-both and hashes",
    );
    await request("POST", "sources", {
      path: join(source, "large.bin"),
      policy: { scheduling: { manual: true } },
      createSnapshot: true,
    });
    const fileSnapshot = await wait(async () =>
      (await request("GET", "snapshots")).snapshots.find(
        (entry) => entry.rootEntryType === "f",
      ),
    );
    await restoreSingle({
      vaultId,
      sourceId: "file-root",
      dialogTitle: "Fixture file source",
      item: {
        name: "large.bin",
        objectId: fileSnapshot.rootID,
        snapshotId: fileSnapshot.id,
        type: "FILE",
      },
    });
    const rootResult = await wait(async () => {
      const [result] = await listRestores({ sourceId: "file-root" });
      return result.status !== "RUNNING" ? result : null;
    });
    assert.equal(rootResult.status, "COMPLETE", JSON.stringify(rootResult));
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(output, "large (3).bin")))
        .digest("hex"),
      expected["large.bin"],
    );
    console.info(
      "Restore fixture: standalone file-source snapshot restores with keep-both and matching hash",
    );
    await run(
      "missing",
      objectId,
      {
        type: "UNPACKED",
        directoryPath: join(directory, "missing"),
        confirmed: false,
      },
      "FAILED",
    );
    const outside = join(directory, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "sentinel"), "unchanged");
    const linked = join(output, "link");
    await symlink(
      outside,
      linked,
      process.platform === "win32" ? "junction" : "dir",
    );
    await run(
      "junction",
      objectId,
      { type: "UNPACKED", directoryPath: output, confirmed: true },
      "FAILED",
    );
    assert.equal(
      await readFile(join(outside, "sentinel"), "utf8"),
      "unchanged",
    );
    await rm(linked);
    if (process.platform === "win32") {
      const denied = join(directory, "denied");
      await mkdir(denied);
      const sid = /S-1-\d+(?:-\d+)+/.exec(
        execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], {
          encoding: "utf8",
        }),
      )?.[0];
      assert.ok(sid);
      execFileSync("icacls", [denied, "/deny", `*${sid}:(OI)(CI)(W)`]);
      try {
        await run(
          "permission-denied",
          objectId,
          { type: "UNPACKED", directoryPath: denied, confirmed: false },
          "FAILED",
        );
        await run(
          "zip-permission-denied",
          objectId,
          { type: "ZIP", filePath: join(denied, "denied.zip"), compress: true },
          "FAILED",
        );
      } finally {
        execFileSync("icacls", [denied, "/remove:d", `*${sid}`]);
      }
    }
    for (const compress of [false, true]) {
      const filePath = join(directory, `restore-${compress}.zip`);
      const result = await run(
        `zip-${compress}`,
        objectId,
        { type: "ZIP", filePath, compress },
        "PARTIAL",
      );
      assert.equal(result.skipped, 1);
      assert.equal(result.issue, "ZIP");
      const extracted = join(directory, `extracted-${compress}`);
      if (process.platform === "win32") {
        execFileSync("powershell.exe", [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${filePath.replaceAll("'", "''")}' -DestinationPath '${extracted.replaceAll("'", "''")}'`,
        ]);
        const zipExpected = { ...expected };
        delete zipExpected["nested/空/"];
        assert.deepEqual(await hashes(extracted), zipExpected);
      }
    }
    const canceled = join(directory, "canceled");
    await mkdir(canceled);
    await run(
      "cancel",
      objectId,
      { type: "UNPACKED", directoryPath: canceled, confirmed: false },
      "CANCELED",
      (operation) => cancelRestore({ id: operation.id }),
    );
    // Many small entries keep a real task active long enough to exercise engine cancellation.
    const many = join(source, "many");
    await mkdir(many);
    for (let i = 0; i < 2000; i++)
      await writeFile(join(many, `${i}.txt`), `entry ${i}`);
    await request("POST", "sources/upload");
    const largeSnapshot = await wait(async () =>
      (await request("GET", "snapshots")).snapshots.find(
        (entry) => entry.rootEntryType === "d" && entry.id !== snapshot.id,
      ),
    );
    const activeTask = () =>
      wait(async () =>
        (await request("GET", "tasks")).tasks.find(
          (task) => task.kind === "Restore" && task.status === "RUNNING",
        ),
      );
    await run(
      "cancel-active",
      largeSnapshot.rootID,
      { type: "UNPACKED", directoryPath: canceled, confirmed: true },
      "CANCELED",
      async (operation) => {
        await activeTask();
        await cancelRestore({ id: operation.id });
      },
    );
    const interrupted = join(directory, "interrupted");
    const oldProcess = vaults[vaultId].server.process;
    await mkdir(interrupted);
    await run(
      "interrupted",
      largeSnapshot.rootID,
      { type: "UNPACKED", directoryPath: interrupted, confirmed: false },
      "UNAVAILABLE",
      async () => {
        await activeTask();
        vaults[vaultId].server.process.kill();
      },
    );
    await wait(
      () => oldProcess.exitCode !== null || oldProcess.signalCode !== null,
    );
    delete vaults[vaultId];
    vaults[vaultId] = {
      id: vaultId,
      status: "STARTING",
      server: await startVaultServer(vaultId, false),
    };
    assert.equal((await request("GET", "repo/status")).connected, true);
    const reconnected = join(directory, "reconnected");
    await mkdir(reconnected);
    await run(
      "restart-recovery",
      objectId,
      { type: "UNPACKED", directoryPath: reconnected, confirmed: false },
      "COMPLETE",
    );
    assert.deepEqual(await hashes(reconnected), expected);
    console.info(
      "Restore coordinator smoke passed with real-engine file/directory and ZIP hashes, including engine restart recovery.",
    );
    finish();
  } catch (error) {
    finish(error);
  }
});
