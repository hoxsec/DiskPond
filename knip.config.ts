import { readFileSync } from "node:fs";
import type { KnipConfig } from "knip";

const tsconfigRaw = readFileSync("./libs/typescript/base.json", "utf8");
const tsconfig = JSON.parse(tsconfigRaw);

const commonProject = ["src/**/*.{ts,tsx}"];

const config: KnipConfig = {
  compilers: {
    json: () => "",
    mdx: true,
    grit: () => "",
  },
  workspaces: {
    ".": {
      entry: [
        "turbo.json",
        "scripts/*.{mjs,cjs}",
        "scripts/lib/password-fixture.mjs",
        "scripts/lib/discovery-fixture.mjs",
        "scripts/lib/provider-fixture.mjs",
      ],
      project: ["scripts/**/*.{mjs,cjs}"],
      // Smoke/build runners resolve the pinned Electron/build tools from
      // apps/electron via createRequire; they are declared in that workspace.
      ignoreDependencies: [
        "electron",
        "esbuild",
        "@esbuild-plugins/tsconfig-paths",
      ],
      // Windows process cleanup, registry and disposable ACL fixtures use OS tools.
      ignoreBinaries: ["taskkill", "reg", "icacls"],
    },
    "apps/api": {
      project: commonProject,
    },
    "apps/cloud": {
      project: commonProject,
    },
    "apps/desktop": {
      entry: ["vite.config.ts"],
      project: commonProject,
      // Vite resolves this from apps/desktop/public at build time.
      ignoreUnresolved: [/^\/animations\/backup\.lottie(\?url)?$/],
      vite: { config: [] },
    },
    "apps/electron": {
      entry: ["electron.builder.ts"],
      project: commonProject,
      ignoreBinaries: ["ssh-keyscan"],
    },
    "apps/web": {
      entry: ["vite.config.ts"],
      project: commonProject,
      vite: { config: [] },
    },
    "apps/marketing": {
      entry: [
        "src/pages/**/*.{astro,ts}",
        "src/content/**/*.mdx",
        "src/components/Callout.astro",
      ],
      project: ["src/**/*.{astro,mdx,ts,tsx}"],
      ignoreDependencies: [
        // Imported from an Astro client script that Knip does not resolve.
        "country-flag-emoji-polyfill",
        // Used in CSS url() imports which knip doesn't detect
        "@fontsource/space-mono",
        // Used in CSS
        "@tailwindcss/typography",
      ],
    },
    "libs/*": {
      includeEntryExports: true,
      project: commonProject,
    },
    "libs/biome": {
      entry: ["*.grit"],
      project: ["*.grit"],
    },
    "libs/styles": {
      entry: ["*.css"],
      project: ["*.css"],
    },
    "libs/typescript": {
      entry: ["*.json"],
      project: ["*.json"],
    },
    "libs/assets": {
      entry: [],
      project: [],
    },
  },
  ignoreIssues: {
    // Reusable UI primitives retain their shared library API after account UI removal.
    "libs/ui/src/{avatar,card,carousel,radio-group}.tsx": ["exports", "types"],
    // The OS application ID and URI scheme intentionally share a value.
    "libs/constants/src/app.ts": ["duplicates"],
    "libs/db/src/schema.ts": ["exports", "types"],
    "apps/marketing/src/components/react/**": ["exports"],
  },
  ignoreDependencies: ["@blinkdisk/.+", "cloudflare"],
  paths: tsconfig.compilerOptions.paths,
};

export default config;
