import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { electronDirectory, root, run } from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const base = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "Temp", "opencode")
  : tmpdir();
await mkdir(base, { recursive: true });
const directory = await mkdtemp(join(base, "diskpond-update-ui-"));
await require("esbuild").build({
  absWorkingDir: resolve(root, "apps/desktop"),
  entryPoints: [resolve(root, "scripts/lib/update-ui.tsx")],
  outfile: join(directory, "fixture.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  jsx: "automatic",
  nodePaths: [resolve(root, "apps/desktop/node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
});
const assets = resolve(root, "apps/desktop/dist/assets");
const css = (await readdir(assets)).find((name) => name.endsWith(".css"));
if (!css) throw new Error("Build the renderer before the update UI fixture");
await writeFile(
  join(directory, "index.html"),
  `<!doctype html><html><head><link rel="stylesheet" href="${pathToFileURL(join(assets, css))}"></head><body><div id="root"></div><script type="module" src="fixture.js"></script></body></html>`,
);
console.info(`Update UI evidence: ${directory}`);
await run(require("electron"), [resolve(root, "scripts/smoke-update-ui.cjs")], {
  cwd: electronDirectory,
  timeout: 40_000,
  env: { ...process.env, DISKPOND_UPDATE_UI: directory },
});
