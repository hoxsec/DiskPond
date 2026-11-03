const assert = require("node:assert/strict");
const { mkdir, readFile, readdir, rm, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  dialog,
  safeStorage,
  session,
  Tray,
} = require("electron");

if (process.env.DISKPOND_RECOVERY_SESSION_PASSWORDS === "1")
  safeStorage.isEncryptionAvailable = () => false;

let recoveryStarted = false;
let trayMenu;
const corePids = [];
const coreProcesses = new Map();
const networkRequests = [];
if (process.env.DISKPOND_RECOVERY_PHASE) {
  app.setPath(
    "appData",
    join(process.env.DISKPOND_VAULT_FIXTURE, "os-app-data"),
  );
  const isRemote = (value) => {
    const url = new URL(value);
    return (
      ["http:", "https:", "ws:", "wss:"].includes(url.protocol) &&
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    );
  };
  const fetch = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    const url =
      typeof input === "string" || input instanceof URL ? input : input.url;
    if (isRemote(url)) {
      networkRequests.push(`main:${new URL(url).origin}`);
      return Promise.reject(
        new Error("Remote fetch blocked by recovery fixture"),
      );
    }
    return fetch(input, options);
  };
  app.on("ready", () =>
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const remote = isRemote(details.url);
      if (remote)
        networkRequests.push(`chromium:${new URL(details.url).origin}`);
      callback({ cancel: remote });
    }),
  );
  const childProcess = require("node:child_process");
  const spawn = childProcess.spawn;
  childProcess.spawn = function (command, args, options) {
    const child = spawn.call(this, command, args, options);
    if (/kopia(?:\.exe)?$/i.test(command) && child.pid) {
      corePids.push(child.pid);
      const configIndex = args.indexOf("--config-file");
      if (configIndex >= 0)
        coreProcesses.set(
          require("node:path").basename(args[configIndex + 1], ".config"),
          child,
        );
    }
    return child;
  };
  require("node:module").syncBuiltinESMExports();
  const setContextMenu = Tray.prototype.setContextMenu;
  Tray.prototype.setContextMenu = function (menu) {
    trayMenu = menu;
    return setContextMenu.call(this, menu);
  };
}

const directory = process.env.DISKPOND_VAULT_FIXTURE;
let selected;
// Only the native picker result is injected; renderer forms, IPC, persistence
// and real engines run unchanged, using this runner's disposable destinations.
dialog.showOpenDialog = async () => ({
  canceled: false,
  filePaths: [selected],
});
let finished = false;
const watchdog = setTimeout(
  () => finish(new Error("Vault flow smoke timed out")),
  process.env.DISKPOND_RECOVERY_PHASE ? 240_000 : 165_000,
);
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  if (error) console.error(error);
  else
    console.info(
      `Desktop create/connect ${process.env.DISKPOND_VAULT_PHASE} passed.`,
    );
  app.once("will-quit", () => app.exit(error ? 1 : 0));
  if (trayMenu) trayMenu.items.find((item) => item.label === "Quit").click();
  else app.quit();
}
process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);

async function waitFor(contents, expression) {
  await contents.executeJavaScript(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 20000;
    function check() {
      if (${expression}) return resolve(true);
      if (Date.now() >= deadline) return reject(new Error('Timed out: ' + ${JSON.stringify(expression)} + '\\n' + document.body.innerText));
      setTimeout(check, 50);
    }
    check();
  })`);
}
const text = (contents, value) =>
  waitFor(
    contents,
    `document.body.innerText.includes(${JSON.stringify(value)})`,
  );
async function key(contents, keyCode, modifiers = []) {
  contents.sendInputEvent({ type: "keyDown", keyCode, modifiers });
  if (keyCode === "Return")
    contents.sendInputEvent({ type: "char", keyCode: "\r" });
  contents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
  await contents.executeJavaScript(
    "new Promise(resolve => requestAnimationFrame(resolve))",
  );
}
async function tabTo(contents, expression, modifiers = []) {
  for (let index = 0; index < 80; index++) {
    if (await contents.executeJavaScript(expression)) return;
    await key(contents, "Tab", modifiers);
  }
  throw new Error(`Keyboard could not reach ${expression}`);
}
async function activate(contents, label, prefix = false) {
  await tabTo(
    contents,
    `document.activeElement?.matches('button') && document.activeElement.textContent.trim().${prefix ? "startsWith" : "includes"}(${JSON.stringify(label)})`,
  );
  await key(contents, "Return");
}
async function fill(contents, id, value) {
  await tabTo(contents, `document.activeElement?.id === ${JSON.stringify(id)}`);
  await key(contents, "A", ["control"]);
  await contents.insertText(value);
  await key(contents, "Tab");
}
async function close(contents) {
  await key(contents, "Escape");
  await waitFor(contents, "!document.querySelector('[role=dialog]')");
}
async function home(contents) {
  await contents.executeJavaScript("location.hash = '#/local'");
  await text(contents, "Create a new vault");
}
async function destination(contents, intent, name) {
  selected = join(directory, name);
  await activate(
    contents,
    intent === "CREATE" ? "Create a new vault" : "Connect an existing vault",
  );
  await waitFor(
    contents,
    "document.querySelector('input[aria-label=\"Search storage providers\"]')",
  );
  await waitFor(
    contents,
    "document.activeElement?.getAttribute('aria-label') === 'Search storage providers'",
  );
  await activate(contents, "This computer", true);
  await text(contents, "Select destination folder");
  await activate(contents, "Select destination folder");
  await text(contents, selected);
  await activate(contents, "Continue");
}
async function capture(contents, name) {
  if (!process.env.DISKPOND_SMOKE_CAPTURE_DIR) return;
  await contents.executeJavaScript(`(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    await document.fonts.ready;
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
async function savedVaults() {
  return JSON.parse(
    await readFile(
      join(process.env.DISKPOND_DATA_DIR, "accounts/local/vault.json"),
      "utf8",
    ),
  );
}

app.on("browser-window-created", (_, window) => {
  const contents = window.webContents;
  if (process.env.DISKPOND_RECOVERY_PHASE)
    contents.on("console-message", (_, details) => {
      if (details.level === "error")
        console.error("Recovery renderer:", details.message);
    });
  contents.on("preload-error", (_, file, error) =>
    finish(new Error(`${file}: ${error.message}`)),
  );
  contents.once("did-finish-load", async () => {
    try {
      if (process.env.DISKPOND_RECOVERY_PHASE && recoveryStarted) return;
      window.show();
      window.focus();
      contents.focus();
      contents.closeDevTools();
      if (process.env.DISKPOND_RECOVERY_PHASE) {
        recoveryStarted = true;
        await require("./smoke-recovery.cjs")({
          contents,
          directory,
          activate,
          fill,
          text,
          waitFor,
          tabTo,
          key,
          destination,
          capture,
          networkRequests,
          interrupt: async (id) => {
            const child = coreProcesses.get(id);
            assert(child, "Expected an owned vault process");
            const exited = new Promise((resolve) =>
              child.once("exit", resolve),
            );
            child.kill();
            await exited;
          },
          select: (path) => {
            selected = path;
          },
          reopen: async () => {
            await new Promise((resolve, reject) => {
              const deadline = Date.now() + 20_000;
              function check() {
                if (corePids.length >= 2) return resolve();
                if (Date.now() >= deadline)
                  return reject(
                    new Error("Engines did not start before window close"),
                  );
                setTimeout(check, 50);
              }
              check();
            });
            const current = BrowserWindow.fromWebContents(contents);
            const closed = new Promise((resolve) =>
              current.once("closed", resolve),
            );
            current.close();
            await closed;
            assert.equal(
              (await savedVaults()).length,
              2,
              "Window close must preserve vault descriptors",
            );
            assert.equal(BrowserWindow.getAllWindows().length, 0);
            assert(corePids.length > 0);
            for (const pid of corePids) process.kill(pid, 0);
            const loaded = new Promise((resolve) => {
              app.once("browser-window-created", (_, next) => {
                next.webContents.once("did-finish-load", () => {
                  next.show();
                  next.focus();
                  next.webContents.focus();
                  resolve(next.webContents);
                });
              });
            });
            trayMenu.items.find((item) => item.label === "Open").click();
            return loaded;
          },
        });
        await writeFile(
          join(directory, "core-pids.json"),
          JSON.stringify(corePids),
        );
        if (process.platform === "win32") {
          const live = [...coreProcesses.values()]
            .filter((child) => child.exitCode === null && !child.killed)
            .map((child) => child.pid);
          assert(live.length >= 2);
          console.info(
            "Recovery core working sets:",
            require("node:child_process")
              .execFileSync(
                "powershell.exe",
                [
                  "-NoProfile",
                  "-Command",
                  `Get-Process -Id ${live.join(",")} | Select-Object Id,WorkingSet64 | ConvertTo-Json -Compress`,
                ],
                { encoding: "utf8", timeout: 10_000 },
              )
              .trim(),
          );
        }
        return finish();
      }
      if (process.env.DISKPOND_VAULT_PHASE === "restart") {
        await text(contents, "Vaults");
        const vaults = await savedVaults();
        assert.equal(vaults.length, 3);
        for (const vault of vaults) {
          await waitFor(contents, `window.electron && document.body`);
          await contents.executeJavaScript(`new Promise((resolve, reject) => {
            const deadline = Date.now() + 30000;
            async function check() {
              const state = await window.electron.vault.status(${JSON.stringify(vault.id)});
              if (state?.status === 'RUNNING') return resolve(true);
              if (Date.now() >= deadline) return reject(new Error('Vault failed to reconnect'));
              setTimeout(check, 100);
            }
            check();
          })`);
          await contents.executeJavaScript(
            `location.hash = ${JSON.stringify(`#/local/${vault.id}`)}`,
          );
          await text(contents, "Add file/folder");
        }
        return finish();
      }
      await text(contents, "Open DiskPond");
      await activate(contents, "Open DiskPond");
      await text(contents, "Back up and recover your files");

      for (const [intent, name, message] of [
        ["CREATE", "existing", "This destination already contains a vault"],
        [
          "CREATE",
          "unrelated",
          "This destination contains files or repository data",
        ],
        ["CONNECT", "empty", "No vault was found here"],
        ["CONNECT", "unrelated", "No vault was found here"],
        ["CONNECT", "missing", "The destination folder is missing"],
        ["CONNECT", "corrupt", "The repository identity could not be read"],
        ...(process.platform === "win32"
          ? [
              ["CREATE", "denied", "The vault could not be opened"],
              ["CONNECT", "denied", "The vault could not be opened"],
            ]
          : []),
      ]) {
        await destination(contents, intent, name);
        await text(contents, message);
        await waitFor(
          contents,
          "document.activeElement?.querySelector('[role=alert]')",
        );
        await close(contents);
        await waitFor(
          contents,
          `document.activeElement?.textContent.trim() === ${JSON.stringify(intent === "CREATE" ? "Create a new vault" : "Connect an existing vault")}`,
        );
      }
      assert.deepEqual(await readdir(join(directory, "empty")), []);
      assert.equal(
        await readFile(join(directory, "unrelated", "keep.txt"), "utf8"),
        "preserve",
      );

      for (let index = 0; index < 2; index++) {
        await contents.executeJavaScript(
          `window.electron.store.set('preferences.theme', ${JSON.stringify(index ? "dark" : "light")})`,
        );
        await destination(contents, "CREATE", `create-${index}`);
        await text(contents, "Confirm encryption password");
        await waitFor(contents, "document.activeElement?.id === 'name'");
        await fill(contents, "name", `Created ${index}`);
        await fill(contents, "password", ` exact UI password 雪 ${index} `);
        await fill(
          contents,
          "confirmPassword",
          ` exact UI password 雪 ${index} `,
        );
        await capture(contents, `create-details-${index ? "dark" : "light"}`);
        if (!index) {
          const sentinel = join(selected, "appeared-after-discovery.txt");
          await writeFile(sentinel, "preserve");
          await activate(contents, "Create vault");
          await text(
            contents,
            "This destination contains files or repository data",
          );
          assert.equal(
            await contents.executeJavaScript(
              "document.querySelector('#name').value",
            ),
            "Created 0",
          );
          assert.deepEqual(await readdir(selected), [
            "appeared-after-discovery.txt",
          ]);
          await rm(sentinel);
        }
        await activate(contents, "Create vault");
        await waitFor(contents, "!document.querySelector('[role=dialog]')");
        await text(contents, "Add file/folder");
        await home(contents);
      }

      await destination(contents, "CONNECT", "existing");
      await text(contents, "Use the existing vault password");
      assert.equal(
        await contents.executeJavaScript(
          "!!document.querySelector('#confirmPassword')",
        ),
        false,
      );
      await fill(contents, "name", "Connected existing");
      await fill(contents, "password", "wrong");
      await activate(contents, "Connect vault");
      await text(contents, "The encryption password is incorrect");
      await waitFor(
        contents,
        "document.activeElement?.getAttribute('role') === 'alert'",
      );
      assert.equal(
        await contents.executeJavaScript(
          "document.querySelector('#name').value",
        ),
        "Connected existing",
      );
      await contents.executeJavaScript("window.electron.zoom(2)");
      await waitFor(contents, "window.innerWidth < 768");
      await capture(contents, "connect-error-200-percent");
      await fill(contents, "password", "existing-fixture-password");
      await activate(contents, "Connect vault");
      await waitFor(contents, "!document.querySelector('[role=dialog]')");
      await contents.executeJavaScript("window.electron.zoom(1)");
      await text(contents, "Add file/folder");
      await home(contents);
      await destination(contents, "CONNECT", "existing");
      await text(
        contents,
        'already connected on this computer under the name "Connected existing"',
      );
      await close(contents);
      assert.equal((await savedVaults()).length, 3);
      finish();
    } catch (error) {
      await capture(contents, "vault-flow-failure").catch(() => {});
      finish(error);
    }
  });
});
import(
  pathToFileURL(join(__dirname, "../apps/electron/build/index.js")).href
).catch(finish);
