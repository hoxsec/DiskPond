import { config } from "dotenv";

config({
  path: "../../.env",
  quiet: true,
});

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { TanStackRouterVite as router } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { viteStaticCopy as copy } from "vite-plugin-static-copy";
import paths from "vite-tsconfig-paths";

// Path alias seems to break build in CI
import { INTERNAL_PROTOCOL } from "../../libs/constants/src/app";

function injectAppConfig(): Plugin {
  return {
    name: "inject-app-config",
    transformIndexHtml(html) {
      return html.replaceAll("__INTERNAL_PROTOCOL__", INTERNAL_PROTOCOL);
    },
  };
}

export default defineConfig({
  clearScreen: false,
  base: "./",
  build: {
    // Set to hidden to reduce bundle size
    sourcemap: "hidden",
  },
  server: { host: "127.0.0.1", port: 3002, strictPort: true },
  plugins: [
    devtools({
      eventBusConfig: {
        port: 5001,
      },
    }),
    injectAppConfig(),
    paths(),
    router({ target: "react", autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    copy({
      targets: [
        {
          src: [
            "../../locales/en/{translation,error,workspace,settings,validation,sidebar,vault,folder,cron,policy,directory,backup,update,task}.json",
          ],
          dest: "locales/en",
          rename: { stripBase: true },
        },
        {
          src: ["../../libs/assets/favicon"],
          dest: "favicon",
          rename: { stripBase: true },
        },
        {
          src: ["../../libs/styles/fonts/"],
          dest: ".",
        },
      ],
    }),
  ],
});
