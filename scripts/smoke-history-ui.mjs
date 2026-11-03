import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { electronDirectory, root, run } from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const base =
  process.env.DISKPOND_TEST_TMP ||
  (process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Temp", "opencode")
    : tmpdir());
await mkdir(base, { recursive: true });
const directory = await mkdtemp(join(base, "diskpond-history-ui-"));
await require("esbuild").build({
  absWorkingDir: resolve(root, "apps/desktop"),
  entryPoints: [resolve(root, "scripts/lib/history-ui.tsx")],
  outfile: join(directory, "fixture.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  jsx: "automatic",
  loader: { ".svg": "dataurl" },
  nodePaths: [resolve(root, "apps/desktop/node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "legacy-read-fixtures",
      setup(build) {
        build.onResolve(
          {
            filter:
              /^@desktop\/hooks\/(?:queries\/(?:core\/use-(?:source-list|backup-list|vault-devices|mount)|use-(?:completed-backup-list|restore-list|platform|vault-list))|mutations\/core\/use-(?:backup-start-feedback|cancel-backup|start-restore|start-mount|stop-mount)|state\/use-(?:create-source-dialog|create-vault-dialog|delete-source-dialog|task-dialog|delete-backup-dialog|pin-backup-dialog|rename-backup-dialog|restore-directory-dialog)|use-(?:local-profile|source|theme|backup))$/,
          },
          () => ({ path: resolve(root, "scripts/lib/history-ui-state.mjs") }),
        );
      },
    },
  ],
});
const assets = resolve(root, "apps/desktop/dist/assets");
const css = (await readdir(assets)).find((name) => name.endsWith(".css"));
if (!css) throw new Error("Build the renderer before the history UI fixture");
await writeFile(
  join(directory, "index.html"),
  `<!doctype html><html><head><link rel="stylesheet" href="${pathToFileURL(join(assets, css))}"><style>html,body,#root{height:100%}</style></head><body><div id="root"></div><script type="module" src="fixture.js"></script></body></html>`,
);
console.info(`History UI fixture and captures: ${directory}`);
await run(
  require("electron"),
  [resolve(root, "scripts/smoke-history-ui.cjs")],
  {
    cwd: electronDirectory,
    timeout: 100_000,
    env: { ...process.env, DISKPOND_HISTORY_UI: directory },
  },
);
