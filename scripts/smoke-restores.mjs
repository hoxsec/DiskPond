import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  completed,
  electronDirectory,
  launch,
  root,
  stop,
} from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const { build } = require("esbuild");
const { TsconfigPathsPlugin } = require("@esbuild-plugins/tsconfig-paths");
const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-restores-"),
);
const bundle = resolve(electronDirectory, "build/restore-fixture.mjs");
let child;
try {
  await build({
    absWorkingDir: electronDirectory,
    entryPoints: [resolve(root, "scripts/lib/restore-fixture.mjs")],
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
  child = launch(require("electron"), [bundle], {
    cwd: electronDirectory,
    timeout: 180000,
    env: {
      ...process.env,
      DISKPOND_DATA_DIR: directory,
      KOPIA_LOG_DIR: join(directory, "logs"),
      KOPIA_CACHE_DIRECTORY: join(directory, "cache"),
      KOPIA_CHECK_FOR_UPDATES: "false",
    },
  });
  await completed(child);
} finally {
  stop(child);
  await rm(bundle, { force: true });
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}

await import("./smoke-restore-ui.mjs");
