import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
const entry = join(directory, "entry");
const options = {
  cwd: electronDirectory,
  env: {
    ...process.env,
    DISKPOND_PREVIEW: development ? "0" : "1",
    DISKPOND_DATA_DIR: directory,
    DISKPOND_SMOKE_ENTRY: entry,
    DISKPOND_SMOKE_SESSION_PASSWORDS: process.argv.includes(
      "--session-passwords",
    )
      ? "1"
      : "0",
  },
  timeout: 90_000,
};
try {
  // A bare script gets Electron's fallback version ("0.0" on Linux), which is
  // invalid for electron-updater. Let Electron load real app metadata instead.
  const manifest = JSON.parse(
    await readFile(join(electronDirectory, "package.json"), "utf8"),
  );
  await mkdir(entry);
  await writeFile(
    join(entry, "package.json"),
    JSON.stringify({
      name: "diskpond-smoke",
      version: manifest.version,
      main: "index.cjs",
    }),
  );
  await writeFile(
    join(entry, "index.cjs"),
    `require(${JSON.stringify(resolve(root, "scripts/smoke-electron.cjs"))});\n`,
  );
  if (development) {
    await completed(
      pnpm(["run", "dev:desktop", "--smoke"], { ...options, cwd: root }),
    );
  } else {
    await completed(
      pnpm(["--filter", "@blinkdisk/electron", "exec", "install-electron"]),
    );
    const require = createRequire(resolve(electronDirectory, "package.json"));
    await run(require("electron"), [entry], options);
  }
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
  assert.equal(
    protocolRegistration(),
    initialRegistration,
    "Unpackaged launches must preserve the installed DiskPond URI registration",
  );
}
