const assert = require("node:assert/strict");
const { mkdir, readdir, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, nativeTheme, safeStorage, session } = require("electron");

// Failure injection belongs only in the isolated smoke entry point.
const sessionPasswords = process.env.DISKPOND_SMOKE_SESSION_PASSWORDS === "1";
if (sessionPasswords) safeStorage.isEncryptionAvailable = () => false;

const blocked = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (
    ["http:", "https:"].includes(url.protocol) &&
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  ) {
    blocked.push(url.origin);
    return Promise.reject(
      new Error("Remote main-process fetch blocked by smoke test"),
    );
  }
  return originalFetch(input, options);
};
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
      "Desktop smoke passed: account-free onboarding, provider flow, settings/theme/language persistence, retired API rejection, engine discovery; no remote renderer or main-fetch requests.",
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
    button.focus();
    button.click();
  })()`);
}

function waitFor(contents, expression) {
  return contents.executeJavaScript(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;
    function check() {
      if (${expression}) return resolve(true);
      if (Date.now() >= deadline) return reject(new Error('Timed out: ' + ${JSON.stringify(expression)} + '\\nLanguage: ' + document.documentElement.lang + '\\nPreferences: ' + JSON.stringify(window.electron.store.get('preferences')) + '\\n' + document.body.innerText));
      setTimeout(check, 50);
    }
    check();
  })`);
}

async function selectTheme(contents, theme) {
  await contents.executeJavaScript(
    "document.querySelector('[data-slot=select-trigger]').click()",
  );
  await waitFor(contents, "document.querySelector('[role=option]')");
  await contents.executeJavaScript(`(() => {
    const option = [...document.querySelectorAll('[role=option]')].find(element => element.textContent.trim().toLowerCase() === ${JSON.stringify(theme)});
    if (!option) throw new Error('Theme option not found');
    option.click();
  })()`);
  await waitFor(
    contents,
    `window.electron.store.get('preferences.theme') === ${JSON.stringify(theme)}`,
  );
}

async function selectLanguage(contents, code, name, title) {
  await contents.executeJavaScript(
    "document.querySelectorAll('[data-slot=select-trigger]')[1].click()",
  );
  await waitFor(
    contents,
    "[...document.querySelectorAll('[role=option]')].some(element => element.checkVisibility())",
  );
  await contents.executeJavaScript(`(() => {
    const option = [...document.querySelectorAll('[role=option]')].find(element => element.checkVisibility() && element.textContent.trim() === ${JSON.stringify(name)});
    if (!option) throw new Error('Language option not found');
    option.click();
  })()`);
  await waitFor(
    contents,
    "!document.querySelector('[data-slot=select-trigger][aria-expanded=true]')",
  );
  await waitForText(contents, title);
  await waitFor(
    contents,
    `document.documentElement.lang === ${JSON.stringify(code)} && window.electron.store.get('preferences.language') === ${JSON.stringify(code)}`,
  );
}

async function capture(contents, name) {
  if (!process.env.DISKPOND_SMOKE_CAPTURE_DIR) return;
  await contents.executeJavaScript(`(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    await document.fonts.ready;
    await Promise.all([...document.images].filter(image => image.checkVisibility()).map(image => image.decode()));
    await frame();
    await frame();
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    await frame();
    await frame();
  })()`);
  await mkdir(process.env.DISKPOND_SMOKE_CAPTURE_DIR, { recursive: true });
  await writeFile(
    join(process.env.DISKPOND_SMOKE_CAPTURE_DIR, `${name}.png`),
    (await contents.capturePage()).toPNG(),
  );
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
      contents.closeDevTools();
      await waitForText(contents, "Open DiskPond");
      window.show();
      window.focus();
      contents.focus();
      await capture(contents, "welcome");
      const version = await contents.executeJavaScript(
        "window.electron.app.version()",
      );
      assert.equal(version, require("../apps/electron/package.json").version);
      assert.equal(app.getName(), "DiskPond");
      assert.equal(app.getPath("userData"), process.env.DISKPOND_DATA_DIR);
      assert.equal(
        await contents.executeJavaScript(
          "'auth' in window.electron || 'sync' in window.electron",
        ),
        false,
      );
      await contents.executeJavaScript(
        "[...document.querySelectorAll('button')].find(b => b.textContent.includes('Open DiskPond')).focus()",
      );
      contents.sendInputEvent({ type: "keyDown", keyCode: "Return" });
      contents.sendInputEvent({ type: "char", keyCode: "\r" });
      contents.sendInputEvent({ type: "keyUp", keyCode: "Return" });
      await waitForText(contents, "Back up and recover your files");
      if (sessionPasswords) {
        await waitForText(contents, "Vault credentials are session-only");
        await waitForText(contents, "before scheduled backups can resume");
        assert.equal(
          await contents.executeJavaScript(
            "window.electron.vault.password.status().then(s => s.mode)",
          ),
          "SESSION",
        );
      }
      assert.equal(
        await contents.executeJavaScript(
          "window.electron.store.get('passwords')",
        ),
        undefined,
      );
      assert.equal(
        await contents.executeJavaScript(
          "window.electron.store.set('passwords.vlt_test', { type: 'PLAIN', data: 'fixture' }).then(() => false, () => true)",
        ),
        true,
      );
      assert.equal(
        await contents.executeJavaScript(
          "window.electron.vault.password.get({ vaultId: '../other' }).then(() => false, () => true)",
        ),
        true,
      );
      await capture(contents, "home");
      await clickButton(contents, "Create a new vault");
      await waitForText(contents, "SFTP");
      assert.equal(
        await contents.executeJavaScript(
          "/CloudBlink|Sign in|Subscription|Billing|BlinkDisk/.test(document.body.innerText)",
        ),
        false,
      );
      await capture(contents, "providers");
      contents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
      contents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
      await waitFor(contents, "!document.querySelector('[role=dialog]')");
      await waitFor(
        contents,
        "document.activeElement?.textContent.trim() === 'Create a new vault'",
      );
      await contents.executeJavaScript(
        "[...document.querySelectorAll('a')].find(element => element.textContent.trim() === 'Settings').click()",
      );
      await waitForText(contents, "Preferences");
      await waitForText(
        contents,
        sessionPasswords
          ? "Vault credentials are session-only"
          : "Vault credential storage",
      );
      if (sessionPasswords) {
        await waitFor(
          contents,
          "[...document.querySelectorAll('[data-slot=alert-title]')].filter(element => element.textContent === 'Vault credentials are session-only').length === 1",
        );
      }
      for (const theme of ["light", "dark"]) {
        await selectTheme(contents, theme);
        await waitFor(
          contents,
          `document.body.classList.contains('dark') === ${theme === "dark"}`,
        );
        await capture(contents, `settings-${theme}`);
      }
      await selectTheme(contents, "system");
      for (const theme of ["light", "dark"]) {
        nativeTheme.themeSource = theme;
        await waitFor(
          contents,
          `document.body.classList.contains('dark') === ${theme === "dark"}`,
        );
      }
      await selectTheme(contents, "dark");
      for (const [code, name, title] of [
        ["es", "Español", "Preferencias"],
        ["fr", "Français", "Préférences"],
        ["de", "Deutsch", "Voreinstellungen"],
        ["tr", "Türkçe", "Tercihler"],
        ["nl", "Nederlands", "Voorkeuren"],
        ["it", "Italiano", "Preferenze"],
        ["pl", "Polski", "Preferencje"],
      ]) {
        await selectLanguage(contents, code, name, title);
        const loaded = new Promise((resolve) =>
          contents.once("did-finish-load", resolve),
        );
        contents.reload();
        await loaded;
        await waitForText(contents, title);
        await waitFor(
          contents,
          `document.documentElement.lang === ${JSON.stringify(code)}`,
        );
        assert.equal(
          await contents.executeJavaScript(
            "window.electron.store.get('preferences.language')",
          ),
          code,
        );
        await capture(contents, `settings-${code}`);
      }
      await selectLanguage(contents, "en", "English", "Preferences");
      await contents.executeJavaScript("window.electron.zoom(2)");
      await waitFor(contents, "window.innerWidth < 768");
      await capture(contents, "settings-200-percent");
      await clickButton(contents, "Menu");
      await waitFor(contents, "document.querySelector('[role=menuitem]')");
      await contents.executeJavaScript(
        "[...document.querySelectorAll('[role=menuitem]')].find(element => element.textContent.trim() === 'Home').click()",
      );
      await waitFor(contents, "!document.querySelector('[role=menu]')");
      await waitForText(contents, "Back up and recover your files");
      await clickButton(contents, "Create a new vault");
      await waitForText(contents, "SFTP");
      await capture(contents, "providers-200-percent");
      contents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
      contents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
      await waitFor(contents, "!document.querySelector('[role=dialog]')");
      await clickButton(contents, "Menu");
      await waitFor(contents, "document.querySelector('[role=menuitem]')");
      await contents.executeJavaScript(
        "[...document.querySelectorAll('[role=menuitem]')].find(element => element.textContent.trim() === 'Settings').click()",
      );
      await waitFor(contents, "!document.querySelector('[role=menu]')");
      await waitForText(contents, "Preferences");
      await contents.executeJavaScript(
        "[...document.querySelectorAll('button')].find(element => element.textContent.trim() === 'Report an issue').scrollIntoView()",
      );
      await capture(contents, "about-200-percent");
      await contents.executeJavaScript("window.electron.zoom(1)");
      const loaded = new Promise((resolve) =>
        contents.once("did-finish-load", resolve),
      );
      contents.reload();
      await loaded;
      await waitForText(contents, "Preferences");
      assert.equal(
        await contents.executeJavaScript(
          "window.electron.store.get('workspaceReady')",
        ),
        true,
      );
      assert.equal(
        await contents.executeJavaScript(
          "window.electron.store.get('preferences.theme')",
        ),
        "dark",
      );
      assert.equal(
        await contents.executeJavaScript(
          "fetch('diskpondapp://api/trpc').then(r => r.status)",
        ),
        404,
      );
      await contents.executeJavaScript("location.hash = '#/acct_legacy'");
      await waitForText(contents, "Back up and recover your files");
      assert.equal(
        await contents.executeJavaScript("location.hash"),
        "#/local",
      );
      const destination = join(
        process.env.DISKPOND_DATA_DIR,
        "empty-destination",
      );
      await mkdir(destination);
      const result = await contents.executeJavaScript(
        `window.electron.vault.validate(${JSON.stringify({ type: "INTERNAL_DRIVE", config: { path: destination } })})`,
      );
      assert.equal(result.code, "NOT_INITIALIZED");
      assert.deepEqual(await readdir(destination), []);
      assert.deepEqual(blocked, []);
      finish();
    } catch (error) {
      await capture(contents, "failure").catch(() => {});
      finish(error);
    }
  });
});

import(
  pathToFileURL(join(__dirname, "../apps/electron/build/index.js")).href
).catch(finish);
