import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { electronDirectory, root, run } from "./lib/process.mjs";

const require = createRequire(resolve(electronDirectory, "package.json"));
const base = join(process.env.LOCALAPPDATA, "Temp", "opencode");
await mkdir(base, { recursive: true });
const directory = await mkdtemp(join(base, "diskpond-update-banner-"));
await require("esbuild").build({
  absWorkingDir: resolve(root, "apps/desktop"),
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { SidebarAlerts } from "@desktop/components/sidebar/alerts";
      import { CheckForUpdates } from "@desktop/components/settings/check-for-updates";
      import { useUpdateListener } from "@desktop/hooks/use-update-listener";
      window.opened = 0;
      window.failOpen = false;
      window.electron = { update: {
        check: () => new Promise((resolve, reject) => { window.finishCheck = resolve; window.failCheck = reject; }),
        status: async () => ({ available: false, version: null }),
        change: (callback) => { window.publish = callback; return () => {}; },
        openReleases: async () => {
          if (window.failOpen) throw new Error("Browser unavailable");
          window.opened++;
        },
      }};
      function Fixture() {
        useUpdateListener();
        return <ul><SidebarAlerts /></ul>;
      }
      const root = createRoot(document.getElementById("root"));
      root.render(<Fixture />);
      window.showSettings = () => root.render(<CheckForUpdates />);
    `,
    resolveDir: resolve(root, "apps/desktop"),
    loader: "tsx",
  },
  outfile: join(directory, "fixture.js"),
  bundle: true,
  platform: "browser",
  format: "esm",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "translation-fixture",
      setup(build) {
        build.onResolve(
          { filter: /^@blinkdisk\/hooks\/use-app-translation$/ },
          () => ({ path: "translation", namespace: "fixture" }),
        );
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const useAppTranslation = () => ({ t: (key, values) => key === "title" || key === "updateAvailable" ? "DiskPond " + values.version + " available" : key === "error" || key === "updateError" ? "Couldn't complete request. Try again." : key === "checkUpdates" ? "Check for updates" : key === "upToDate" ? "You're up to date" : "View GitHub releases" });`,
          loader: "js",
        }));
      },
    },
  ],
});
await writeFile(
  join(directory, "index.html"),
  '<div id="root"></div><script type="module" src="fixture.js"></script>',
);
await writeFile(
  join(directory, "main.cjs"),
  `
  const { app, BrowserWindow } = require("electron");
  const assert = require("node:assert/strict");
  app.setPath("userData", ${JSON.stringify(join(directory, "profile"))});
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: true, webPreferences: { contextIsolation: true } });
    await win.loadFile(${JSON.stringify(join(directory, "index.html"))});
    const evaluate = (code) => win.webContents.executeJavaScript(code);
    const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await settle();
    assert.equal(await evaluate('document.querySelectorAll("button").length'), 0);
    await evaluate('window.publish({ available: true, version: "0.1.0-alpha.4" })');
    await settle();
    assert.match(await evaluate('document.body.textContent'), /0.1.0-alpha.4/);
    win.focus();
    await evaluate('document.querySelector("button").focus()');
    win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Return" });
    win.webContents.sendInputEvent({ type: "char", keyCode: "\\r" });
    win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Return" });
    await settle();
    assert.equal(await evaluate('window.opened'), 1);
    await evaluate('window.failOpen = true; document.querySelector("button").click()');
    await settle();
    assert.match(await evaluate('document.querySelector("[role=alert]").textContent'), /Try again/);
    await evaluate('window.failOpen = false; document.querySelector("button").click()');
    await settle();
    assert.equal(await evaluate('window.opened'), 2);
    await evaluate('window.publish({ available: false, version: null })');
    await settle();
    assert.equal(await evaluate('document.querySelectorAll("button").length'), 0);
    console.log("PASS: banner visibility, version, keyboard activation, browser failure and retry");
    await evaluate('window.showSettings()');
    await settle();
    await evaluate('document.querySelector("button").click()');
    await settle();
    assert.equal(await evaluate('document.querySelector("button").disabled'), true);
    assert.equal(await evaluate('document.querySelector("button").getAttribute("aria-busy")'), "true");
    assert.equal(await evaluate('!!document.querySelector("button svg")'), true);
    await evaluate('window.finishCheck({available: false, version: "0.1.0-alpha.3"})');
    await settle();
    assert.match(await evaluate('document.querySelector("[role=status]").textContent'), /up to date/);
    await evaluate('document.querySelector("button").click()');
    await settle();
    await evaluate('window.failCheck(new Error("offline"))');
    await settle();
    assert.match(await evaluate('document.querySelector("[role=status]").textContent'), /Try again/);
    await evaluate('document.querySelector("button").click()');
    await settle();
    await evaluate('window.finishCheck({available: true, version: "0.1.0-alpha.4"})');
    await settle();
    assert.match(await evaluate('document.querySelector("[role=status]").textContent'), /0.1.0-alpha.4/);
    assert.equal(await evaluate('document.querySelectorAll("button").length'), 2);
    console.log("PASS: manual check spinner/disabled state, current version, failure/retry, update available");
    app.exit(0);
  }).catch(error => { console.error(error); app.exit(1); });
`,
);
console.info(`Update banner fixture: ${directory}`);
await run(require("electron"), [join(directory, "main.cjs")], {
  cwd: electronDirectory,
  timeout: 30_000,
});
