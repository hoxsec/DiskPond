import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus, release, tmpdir, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { electronDirectory, root, run } from "./lib/process.mjs";

const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-recovery-"),
);
const require = createRequire(resolve(electronDirectory, "package.json"));
const sentinel = "Untouched BlinkDisk fixture settings and credentials";
function registrations() {
  if (process.platform !== "win32") return [];
  return ["com.blinkdisk.app", "io.github.hoxsec.diskpond"].map((name) => {
    const result = spawnSync(
      "reg",
      ["query", `HKCU\\Software\\Classes\\${name}`, "/s"],
      { encoding: "utf8", timeout: 5_000 },
    );
    if (result.error) throw result.error;
    assert([0, 1].includes(result.status));
    return result.stdout;
  });
}
const initialRegistrations = registrations();
async function usage(path) {
  const result = { bytes: 0, files: 0, logBytes: 0 };
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const location = join(path, entry.name);
    if (entry.isDirectory()) {
      const child = await usage(location);
      for (const key of Object.keys(result)) result[key] += child[key];
    } else if (entry.isFile()) {
      const size = (await stat(location)).size;
      result.bytes += size;
      result.files++;
      if (/\.log(?:\.|$)/i.test(entry.name)) result.logBytes += size;
    }
  }
  return result;
}
try {
  for (const name of ["blinkdisk", "blinkdisk-dev"]) {
    await mkdir(join(directory, "os-app-data", name), { recursive: true });
    await writeFile(
      join(directory, "os-app-data", name, "config.json"),
      sentinel,
    );
  }
  console.info(
    JSON.stringify({
      os: release(),
      cpu: cpus()[0]?.model,
      memoryGiB: totalmem() / 2 ** 30,
      node: process.version,
      firewall: process.env.DISKPOND_OFFLINE_CERTIFICATION === "1",
    }),
  );
  for (const index of [0, 1]) await mkdir(join(directory, `vault-${index}`));
  for (const phase of ["setup", "restart"]) {
    await run(
      require("electron"),
      [resolve(root, "scripts/smoke-vault-flows.cjs")],
      {
        cwd: electronDirectory,
        env: {
          ...process.env,
          DISKPOND_PREVIEW: "1",
          DISKPOND_DATA_DIR: join(directory, "app-data"),
          DISKPOND_VAULT_FIXTURE: directory,
          DISKPOND_VAULT_PHASE: `recovery-${phase}`,
          DISKPOND_RECOVERY_PHASE: phase,
          DISKPOND_RECOVERY_SESSION_PASSWORDS: process.argv.includes(
            "--session-passwords",
          )
            ? "1"
            : "0",
        },
        timeout: 255_000,
      },
    );
    const pids = JSON.parse(
      await readFile(join(directory, "core-pids.json"), "utf8"),
    );
    assert(pids.length >= 2, "Both engines must have started");
    const alive = (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        if (error.code === "ESRCH") return false;
        throw error;
      }
    };
    const deadline = Date.now() + 10_000;
    while (pids.some(alive) && Date.now() < deadline) await delay(100);
    assert(!pids.some(alive), "Tray quit left an owned engine running");
    console.info(`Recovery ${phase}: tray quit cleaned up both engines.`);
    console.info(
      `Recovery ${phase} app-data usage: ${JSON.stringify(await usage(join(directory, "app-data")))}`,
    );
    for (const name of ["blinkdisk", "blinkdisk-dev"]) {
      const path = join(directory, "os-app-data", name);
      assert.deepEqual(await readdir(path), ["config.json"]);
      assert.equal(await readFile(join(path, "config.json"), "utf8"), sentinel);
    }
    assert.deepEqual(
      registrations(),
      initialRegistrations,
      "Existing BlinkDisk/DiskPond registrations must be preserved",
    );
  }
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
