import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { electronDirectory, root, run } from "./lib/process.mjs";

if (process.platform !== "win32")
  throw new Error("README captures use the Windows desktop release");
const base =
  process.env.DISKPOND_TEST_TMP ||
  join(process.env.LOCALAPPDATA, "Temp", "opencode");
await mkdir(base, { recursive: true });
const directory = await mkdtemp(join(base, "diskpond-readme-"));
const drive = ["R:", "S:", "T:", "U:", "V:"].find(
  (letter) => !existsSync(`${letter}\\`),
);
if (!drive) throw new Error("A free temporary drive letter is needed");
const require = createRequire(resolve(electronDirectory, "package.json"));
let mapped = false;
try {
  // A disposable drive gives screenshots readable, non-personal source paths.
  execFileSync("subst", [drive, directory]);
  mapped = true;
  await run(
    require("electron"),
    [resolve(root, "scripts/smoke-vault-flows.cjs")],
    {
      cwd: electronDirectory,
      timeout: 180_000,
      env: {
        ...process.env,
        DISKPOND_PREVIEW: "1",
        DISKPOND_DATA_DIR: join(directory, "app-data"),
        DISKPOND_VAULT_FIXTURE: `${drive}\\`,
        DISKPOND_VAULT_PHASE: "screenshots",
        DISKPOND_SMOKE_CAPTURE_DIR: resolve(root, "docs/images"),
      },
    },
  );
} finally {
  if (mapped) execFileSync("subst", [drive, "/d"]);
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
