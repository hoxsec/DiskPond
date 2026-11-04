import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { site } from "./site/config";

export default defineConfig({
  site: site.url,
  // The inherited BlinkDisk site remains in src/ and public/ as reference.
  srcDir: "./site",
  publicDir: "./static",
  output: "static",
  trailingSlash: "never",
  server: { host: "127.0.0.1", port: 3000 },
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith("/404"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
