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
        "scripts/lib/restore-fixture.mjs",
        "scripts/lib/restore-ui.mjs",
        "scripts/lib/restore-ui-state.mjs",
        "scripts/lib/history-fixture.mjs",
        "scripts/lib/history-ui.tsx",
        "scripts/lib/history-ui-state.mjs",
      ],
      project: ["scripts/**/*.{mjs,cjs,tsx}"],
      // Smoke/build runners resolve the pinned Electron/build tools from
      // apps/electron via createRequire; they are declared in that workspace.
      ignoreDependencies: [
        "electron",
        "esbuild",
        "@esbuild-plugins/tsconfig-paths",
        // Renderer component fixtures resolve these from apps/desktop.
        "react",
        "react-dom",
        "@tanstack/react-query",
        "@tanstack/react-router",
      ],
      // Windows process, registry, ACL and screenshot fixtures use OS tools.
      ignoreBinaries: ["taskkill", "reg", "icacls", "powershell.exe", "subst"],
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
        "site/pages/**/*.{astro,ts}",
        "src/pages/**/*.{astro,ts}",
        "src/content/**/*.mdx",
        "src/content.config.ts",
        "src/components/Callout.astro",
      ],
      project: ["site/**/*.{astro,ts}", "src/**/*.{astro,mdx,ts,tsx}"],
      ignoreDependencies: [
        // Retain the inherited site's compiler integrations with its reference
        // sources; the active static DiskPond site does not load these plugins.
        "@astrojs/mdx",
        "@astrojs/react",
        "astro-mermaid",
        "vite-plugin-static-copy",
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
    // The inherited comparison sitemap API remains available to reference code.
    "libs/constants/src/comparison.ts": ["exports"],
    "libs/db/src/schema.ts": ["exports", "types"],
    "apps/marketing/src/components/react/**": ["exports"],
  },
  ignoreDependencies: ["@blinkdisk/.+", "cloudflare"],
  paths: tsconfig.compilerOptions.paths,
};

export default config;
