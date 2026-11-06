import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  completed,
  electronDirectory,
  launch,
  pnpm,
  root,
  stop,
} from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const { build } = require("esbuild");
const { TsconfigPathsPlugin } = require("@esbuild-plugins/tsconfig-paths");
const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-password-smoke-"),
);
const bundle = resolve(electronDirectory, "build/password-fixture.mjs");
const secrets = [
  "DiskPond-fixture-only-雪-01",
  "DiskPond-fixture-only-雪-02",
  " DiskPond-fixture-only-雪-03 ",
];
let child;

async function checkNoPasswordFiles(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await checkNoPasswordFiles(file);
    else {
      assert.ok(
        !/\.(kopia|blinkdisk)-password$/.test(entry.name),
        "Engine persisted a password file",
      );
      const contents = await readFile(file);
      for (const secret of secrets) {
        assert.ok(
          !contents.includes(Buffer.from(secret)),
          "Fixture contains a plaintext password",
        );
        assert.ok(
          !contents.includes(
            Buffer.from(Buffer.from(secret).toString("base64")),
          ),
          "Fixture contains a base64 password",
        );
      }
    }
  }
}

try {
  await completed(
    pnpm(["--filter", "@diskpond/electron", "exec", "install-electron"]),
  );
  await build({
    absWorkingDir: electronDirectory,
    entryPoints: [resolve(root, "scripts/lib/password-fixture.mjs")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["electron"],
    plugins: [
      TsconfigPathsPlugin({
        tsconfig: resolve(electronDirectory, "tsconfig.json"),
      }),
    ],
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
  for (const mode of ["protected", "session", "failure"]) {
    for (const phase of ["create", "restart"]) {
      child = launch(require("electron"), [bundle], {
        cwd: electronDirectory,
        env: {
          ...process.env,
          DISKPOND_DATA_DIR: join(directory, mode),
          DISKPOND_PASSWORD_TEST_MODE: mode,
          DISKPOND_PASSWORD_TEST_PHASE: phase,
          KOPIA_CACHE_DIRECTORY: join(directory, mode, "engine-cache"),
          KOPIA_LOG_DIR: join(directory, mode, "engine-logs"),
        },
        timeout: 90_000,
      });
      await completed(child);
      await checkNoPasswordFiles(join(directory, mode));
    }
  }
  // Existing protected records with a subsequently locked key store.
  child = launch(require("electron"), [bundle], {
    cwd: electronDirectory,
    env: {
      ...process.env,
      DISKPOND_DATA_DIR: join(directory, "protected"),
      DISKPOND_PASSWORD_TEST_MODE: "locked",
      DISKPOND_PASSWORD_TEST_PHASE: "restart",
      KOPIA_CACHE_DIRECTORY: join(directory, "protected", "engine-cache"),
      KOPIA_LOG_DIR: join(directory, "protected", "engine-logs"),
    },
    timeout: 90_000,
  });
  await completed(child);
  await checkNoPasswordFiles(join(directory, "protected"));
  console.info(
    "Password smoke passed: native OS round-trip, three independent vaults, exact whitespace passwords, session-only/failed/locked protection, wrong-password rejection, restart, engine interruption/reconnect, and plaintext/base64 scan.",
  );
} finally {
  stop(child);
  await rm(bundle, { force: true });
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
