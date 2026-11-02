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
  banner: {
    js:
      "import { createRequire } from 'module';\n" +
      "const require = createRequire(import.meta.url);",
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

if (isDev && process.argv[3] !== "once") {
  await Promise.all([
    (await esbuild.context(index)).watch(),
    (await esbuild.context(preload)).watch(),
  ]);
} else {
  await Promise.all([esbuild.build(index), esbuild.build(preload)]);
}
