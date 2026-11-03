import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join, resolve } from "node:path";
import { electronDirectory, root, run } from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const base = join(process.env.LOCALAPPDATA, "Temp", "opencode");
await mkdir(base, { recursive: true });
const directory = await mkdtemp(join(base, "diskpond-update-activity-"));
const bundle = join(electronDirectory, "build", `${basename(directory)}.mjs`);
await require("esbuild").build({
  absWorkingDir: electronDirectory,
  entryPoints: [resolve(root, "scripts/lib/update-activity-fixture.mjs")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "esm",
  external: [
    "electron",
    "cpu-features",
    "./crypto/build/Release/sshcrypto.node",
  ],
  plugins: [
    require("@esbuild-plugins/tsconfig-paths").TsconfigPathsPlugin({
      tsconfig: resolve(electronDirectory, "tsconfig.json"),
    }),
  ],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const __dirname = import.meta.dirname;",
  },
});
console.info(`Update activity evidence: ${directory}`);
try {
  await run(require("electron"), [bundle], {
    cwd: electronDirectory,
    timeout: 120_000,
    env: {
      ...process.env,
      DISKPOND_DATA_DIR: directory,
      KOPIA_LOG_DIR: join(directory, "logs"),
      KOPIA_CHECK_FOR_UPDATES: "false",
    },
  });
} finally {
  await rm(bundle, { force: true });
}
