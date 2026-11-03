import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { config } from "dotenv";

config({
  path: "../../.env",
  quiet: true,
});

import { TsconfigPathsPlugin } from "@esbuild-plugins/tsconfig-paths";
import esbuild from "esbuild";

const isDev = process.argv[2] === "development";
const values = {
  NODE_ENV: isDev ? "development" : "production",
  DESKTOP_URL: "http://127.0.0.1:3002",
};
const env = Object.fromEntries(
  Object.entries(values).map(([key, value]) => [
    `process.env.${key}`,
    JSON.stringify(value),
  ]),
);

const base = {
  minify: !isDev,
  entryPoints: ["./src/index.ts", "./src/preload.ts"],
  bundle: true,
  outdir: "build",
  target: "node22",
  sourcemap: true,
  plugins: [TsconfigPathsPlugin({ tsconfig: "./tsconfig.json" })],
  external: ["electron"],
  define: env,
};

const index = {
  ...base,
  // ssh2 catches missing optional accelerators and uses Node's crypto. Keep
  // the bundled app independent of native addons/Electron ABI rebuilds.
  external: [
    ...base.external,
    "cpu-features",
    "./crypto/build/Release/sshcrypto.node",
  ],
  banner: {
    js:
      "import { createRequire } from 'module';\n" +
      "import { fileURLToPath as bundleFileURLToPath } from 'node:url';\n" +
      "import { dirname as bundleDirname } from 'node:path';\n" +
      "const require = createRequire(import.meta.url);\n" +
      "const __dirname = bundleDirname(bundleFileURLToPath(import.meta.url));",
  },
  entryPoints: ["./src/index.ts"],
  format: "esm",
  platform: "node",
};

const preload = {
  ...base,
  entryPoints: ["./src/preload.ts"],
  format: "cjs",
  platform: "browser",
};

// Keep license texts with the newly bundled storage clients and their JS
// dependencies. build/** is included in desktop distributions.
const licensed = new Set();
await mkdir("build/licenses", { recursive: true });
async function copyStorageLicenses(name, from) {
  const manifestPath = from.resolve(`${name}/package.json`);
  if (licensed.has(manifestPath)) return;
  licensed.add(manifestPath);
  const directory = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const files = (await readdir(directory)).filter((file) =>
    /^licen[cs]e(?:\.|$)/i.test(file),
  );
  if (!files.length) throw new Error(`Missing license for ${name}`);
  for (const file of files)
    await writeFile(
      join("build/licenses", `${name.replaceAll("/", "-")}-${file}.txt`),
      await readFile(join(directory, file)),
    );
  for (const dependency of Object.keys(manifest.dependencies || {}))
    await copyStorageLicenses(dependency, createRequire(manifestPath));
}
for (const name of ["aws4", "ssh2"])
  await copyStorageLicenses(name, createRequire(import.meta.url));

if (isDev && process.argv[3] !== "once") {
  await Promise.all([
    (await esbuild.context(index)).watch(),
    (await esbuild.context(preload)).watch(),
  ]);
} else {
  await Promise.all([esbuild.build(index), esbuild.build(preload)]);
}
