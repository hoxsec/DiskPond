import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { electronDirectory, root, run } from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const { build } = require("esbuild");
const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-restore-ui-"),
);
try {
  await build({
    absWorkingDir: resolve(root, "apps/desktop"),
    entryPoints: [resolve(root, "scripts/lib/restore-ui.mjs")],
    outfile: join(directory, "fixture.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    jsx: "automatic",
    nodePaths: [resolve(root, "apps/desktop/node_modules")],
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "restore-query-fixture",
        setup(build) {
          build.onResolve(
            { filter: /^@desktop\/hooks\/queries\/use-restore-list$/ },
            () => ({ path: resolve(root, "scripts/lib/restore-ui-state.mjs") }),
          );
        },
      },
    ],
  });
  const assets = resolve(root, "apps/desktop/dist/assets");
  const css = (await readdir(assets)).find((name) => name.endsWith(".css"));
  if (!css)
    throw new Error("Build the desktop before running the restore UI fixture");
  await writeFile(
    join(directory, "index.html"),
    `<!doctype html><html><head><link rel="stylesheet" href="${pathToFileURL(join(assets, css))}"></head><body><main id="root" style="padding:16px"></main><script type="module" src="fixture.js"></script></body></html>`,
  );
  await run(
    require("electron"),
    [resolve(root, "scripts/smoke-restore-ui.cjs")],
    {
      cwd: electronDirectory,
      timeout: 40000,
      env: { ...process.env, DISKPOND_RESTORE_UI: directory },
    },
  );
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
