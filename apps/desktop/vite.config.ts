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
import env from "vite-plugin-environment";
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
  define: {
    "process.env.POSTHOG_KEY": JSON.stringify(""),
    "process.env.SENTRY_DESKTOP_DSN": JSON.stringify(""),
    "process.env.LOGSNAG_PUBLIC_KEY": JSON.stringify(""),
  },
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
    env(
      {
        API_URL: "http://127.0.0.1:4000",
        WEB_URL: "http://127.0.0.1:3001",
        MARKETING_URL: "https://github.com/hoxsec/DiskPond",
      },
      {
        loadEnvFiles: false,
      },
    ),
    copy({
      targets: [
        {
          src: ["../../locales/"],
          dest: ".",
        },
        {
          src: ["../../libs/styles/fonts/"],
          dest: ".",
        },
      ],
    }),
  ],
});
