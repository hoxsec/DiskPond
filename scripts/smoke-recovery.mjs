import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus, release, tmpdir, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { electronDirectory, root, run } from "./lib/process.mjs";

const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-recovery-"),
);
const require = createRequire(resolve(electronDirectory, "package.json"));
try {
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
  }
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
