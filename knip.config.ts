import { readFileSync } from "node:fs";
import type { KnipConfig } from "knip";

const tsconfigRaw = readFileSync("./libs/typescript/base.json", "utf8");
const tsconfig = JSON.parse(tsconfigRaw);

const commonProject = ["src/**/*.{ts,tsx}"];

const config: KnipConfig = {
  compilers: {
    json: () => "",
    grit: () => "",
  },
  workspaces: {
    ".": {
      entry: [
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
        "scripts/lib/cloud-provider-ui.tsx",
        "scripts/lib/update-activity-fixture.mjs",
        "scripts/lib/update-ui.tsx",
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
      // Build and smoke runners use native Windows/macOS tools.
      ignoreBinaries: [
        "taskkill",
        "reg",
        "icacls",
        "powershell.exe",
        "pwsh",
        "subst",
        "lipo",
        "codesign",
      ],
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
  },
  ignoreDependencies: ["@diskpond/.+"],
  paths: tsconfig.compilerOptions.paths,
};

export default config;
