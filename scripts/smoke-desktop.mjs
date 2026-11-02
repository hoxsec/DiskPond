import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  completed,
  electronDirectory,
  pnpm,
  root,
  run,
} from "./lib/process.mjs";

function protocolRegistration() {
  if (process.platform !== "win32") return;
  const result = spawnSync(
    "reg",
    ["query", "HKCU\\Software\\Classes\\io.github.hoxsec.diskpond", "/s"],
    { encoding: "utf8", timeout: 5_000 },
  );
  if (result.error) throw result.error;
  assert.ok(
    result.status === 0 || result.status === 1,
    "Registry query failed",
  );
  return result.stdout;
}

const initialRegistration = protocolRegistration();
const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-smoke-"),
);
const development = process.argv.includes("--dev");
const options = {
  cwd: electronDirectory,
  env: {
    ...process.env,
    DISKPOND_PREVIEW: development ? "0" : "1",
    DISKPOND_DATA_DIR: directory,
  },
  timeout: 90_000,
};
try {
  if (development) {
    await completed(
      pnpm(["run", "dev:desktop", "--smoke"], { ...options, cwd: root }),
    );
  } else {
    await completed(
      pnpm(["--filter", "@blinkdisk/electron", "exec", "install-electron"]),
    );
    const require = createRequire(resolve(electronDirectory, "package.json"));
    await run(
      require("electron"),
      [resolve(root, "scripts/smoke-electron.cjs")],
      options,
    );
  }
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
  assert.equal(
    protocolRegistration(),
    initialRegistration,
    "Unpackaged launches must preserve the installed DiskPond URI registration",
  );
}
