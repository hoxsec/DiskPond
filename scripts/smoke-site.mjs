import { mkdir, mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { electronDirectory, root, run } from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const base = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "Temp", "opencode")
  : tmpdir();
await mkdir(base, { recursive: true });
const directory = await mkdtemp(join(base, "diskpond-site-"));
console.info(`Website evidence: ${directory}`);
await run(require("electron"), [resolve(root, "scripts/smoke-site.cjs")], {
  cwd: electronDirectory,
  timeout: 120_000,
  env: {
    ...process.env,
    DISKPOND_SITE_EVIDENCE: directory,
    DISKPOND_SITE_DIST: resolve(root, "apps/marketing/dist"),
  },
});
