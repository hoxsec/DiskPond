const assert = require("node:assert/strict");
const { mkdir, readdir } = require("node:fs/promises");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, session } = require("electron");

const blocked = [];
let finished = false;
const watchdog = setTimeout(
  () => finish(new Error("Desktop smoke test timed out")),
  60_000,
);

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  if (error) console.error(error);
  else
    console.info(
      "Desktop smoke passed: renderer, preload IPC, local workspace, isolated settings, engine discovery; no remote renderer requests.",
    );
  app.once("will-quit", () => app.exit(error ? 1 : 0));
  app.quit();
}

process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);

app.on("ready", () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const remote =
      ["https:", "http:"].includes(url.protocol) &&
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (remote) blocked.push(url.origin);
    callback({ cancel: remote });
  });
});

function waitForText(contents, text) {
  return contents.executeJavaScript(`new Promise((resolve, reject) => {
    const expected = ${JSON.stringify(text)};
    const observer = new MutationObserver(check);
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Missing rendered text: ' + expected + '\\n' + document.body.innerText));
    }, 15000);
    function check() {
      if (!document.body.innerText.includes(expected)) return;
      observer.disconnect();
      clearTimeout(timeout);
      resolve(true);
    }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    check();
  })`);
}

function clickButton(contents, text) {
  return contents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('button')].find(
      (element) => element.textContent.trim() === ${JSON.stringify(text)}
    );
    if (!button) throw new Error('Missing button: ' + ${JSON.stringify(text)});
    button.click();
  })()`);
}

app.on("browser-window-created", (_, window) => {
  window.hide();
  const contents = window.webContents;
  contents.on("preload-error", (_, file, error) =>
    finish(new Error(`${file}: ${error.message}`)),
  );
  contents.on("render-process-gone", (_, details) =>
    finish(new Error(`Renderer exited: ${details.reason}`)),
  );
  contents.on("did-fail-load", (_, code, description, url, mainFrame) => {
    if (mainFrame && code !== -3) finish(new Error(`${description}: ${url}`));
  });
  contents.once("did-finish-load", async () => {
    try {
      await waitForText(contents, "Continue without account");
      const version = await contents.executeJavaScript(
        "window.electron.app.version()",
      );
      assert.equal(typeof version, "string");
      assert.equal(app.getName(), "DiskPond");
      assert.equal(app.getPath("userData"), process.env.DISKPOND_DATA_DIR);
      await clickButton(contents, "Continue without account");
      await waitForText(contents, "Continue anyway");
      await clickButton(contents, "Continue anyway");
      await waitForText(contents, "Create your vault");
      const destination = join(
        process.env.DISKPOND_DATA_DIR,
        "empty-destination",
      );
      await mkdir(destination);
      const result = await contents.executeJavaScript(
        `window.electron.vault.validate(${JSON.stringify({ type: "INTERNAL_DRIVE", config: { path: destination } })})`,
      );
      assert.equal(result.code, "NOT_INITIALIZED");
      // Pinned engine discovery writes this sharding marker. M2/M3 must add a
      // genuinely read-only discovery path; no repository is initialized here.
      assert.deepEqual(await readdir(destination), [".shards"]);
      assert.deepEqual(blocked, []);
      finish();
    } catch (error) {
      finish(error);
    }
  });
});

import(
  pathToFileURL(join(__dirname, "../apps/electron/build/index.js")).href
).catch(finish);
