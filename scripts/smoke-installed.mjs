import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { root as repository, run, stop } from "./lib/process.mjs";

assert.equal(process.platform, "win32", "Installed smoke requires Windows.");
const data = join(process.env.APPDATA, "diskpond");
const updaterCache = join(process.env.LOCALAPPDATA, "diskpond-updater");
const updaterExisted = existsSync(updaterCache);
assert.equal(
  existsSync(data),
  false,
  "Packaged DiskPond data exists; use an isolated Windows user for this test.",
);
for (const hive of ["HKCU", "HKLM"]) {
  const result = spawnSync(
    "reg",
    [
      "query",
      `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`,
      "/s",
      "/f",
      "DiskPond",
      "/d",
      "/e",
    ],
    { encoding: "utf8" },
  );
  assert.equal(
    result.status,
    1,
    "An existing DiskPond installation was found, or the registry check failed. Use an isolated Windows user.",
  );
}
const startupKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const schemeKey = "HKCU\\Software\\Classes\\io.github.hoxsec.diskpond";
assert.equal(
  spawnSync("reg", ["query", startupKey, "/v", "DiskPond"]).status,
  1,
  "DiskPond startup entry already exists.",
);
assert.equal(
  spawnSync("reg", ["query", schemeKey]).status,
  1,
  "DiskPond URI registration already exists.",
);
const temp = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-installed-"),
);
const destination = join(temp, "application");
await mkdir(data);
await writeFile(join(data, ".m1-fixture"), temp);
let child;
let client;
let mainClient;
let installed = false;

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((ok, fail) => {
    socket.addEventListener("open", ok, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  const pending = new Map();
  let id = 0;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) pending.get(message.id)?.(message);
  });
  return {
    close: () => socket.close(),
    call: (method, params = {}) =>
      new Promise((ok, fail) => {
        const requestId = ++id;
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          fail(new Error(`CDP timeout: ${method}`));
        }, 30_000);
        pending.set(requestId, (message) => {
          clearTimeout(timeout);
          pending.delete(requestId);
          if (message.error) fail(new Error(JSON.stringify(message.error)));
          else ok(message.result);
        });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      }),
  };
}

async function evaluate(expression) {
  const response = await client.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails)
    throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}

async function waitText(text) {
  for (let i = 0; i < 60; i++) {
    if (
      await evaluate(
        `document.body?.innerText.includes(${JSON.stringify(text)}) ?? false`,
      )
    )
      return;
    await delay(250);
  }
  throw new Error(`Missing text ${text}`);
}

async function click(text) {
  await evaluate(
    `(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('missing button'); button.click(); })()`,
  );
}

try {
  await run(
    resolve(repository, "apps/electron/dist/DiskPond-Windows.exe"),
    ["/S", `/D=${destination}`],
    { timeout: 180_000 },
  );
  installed = true;
  assert.equal(existsSync(join(destination, "DiskPond.exe")), true);
  child = spawn(
    join(destination, "DiskPond.exe"),
    ["--remote-debugging-port=0", "--inspect=127.0.0.1:0"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  let debugPort;
  let inspector;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null)
      throw new Error(`Packaged app exited ${child.exitCode}: ${output}`);
    debugPort = output.match(
      /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//,
    )?.[1];
    inspector = output.match(
      /Debugger listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/,
    )?.[1];
    if (debugPort && inspector) break;
    await delay(250);
  }
  assert.ok(debugPort && inspector, "Debug endpoints did not start");
  let page;
  for (let i = 0; i < 60; i++) {
    const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(
      (r) => r.json(),
    );
    page = targets.find(
      (target) =>
        target.type === "page" &&
        target.url.startsWith("diskpondapp://frontend"),
    );
    if (page) break;
    await delay(250);
  }
  assert.ok(page, "No packaged frontend target");
  client = await connect(page.webSocketDebuggerUrl);
  mainClient = await connect(inspector);
  await waitText("Open DiskPond");
  const registration = spawnSync(
    "reg",
    ["query", `${schemeKey}\\shell\\open\\command`, "/ve"],
    { encoding: "utf8" },
  );
  assert.equal(registration.status, 0, "Packaged URI registration is missing");
  assert.ok(registration.stdout.includes(join(destination, "DiskPond.exe")));
  assert.equal(await evaluate("window.electron.app.version()"), "0.0.0");
  assert.equal(
    await evaluate("'auth' in window.electron || 'sync' in window.electron"),
    false,
  );
  await click("Open DiskPond");
  await waitText("Back up and recover your files");
  await waitText("Create a new vault");
  await waitText("Connect an existing vault");
  const probe = join(temp, "destination");
  await mkdir(probe);
  const result = await evaluate(
    `window.electron.vault.validate(${JSON.stringify({ type: "INTERNAL_DRIVE", config: { path: probe } })})`,
  );
  assert.equal(result.code, "NOT_INITIALIZED");
  assert.deepEqual(await readdir(probe), []);
  assert.deepEqual(
    await readFile(join(destination, "resources/assets/icon.png")),
    await readFile("apps/electron/icon/icon.png"),
  );
  assert.equal(
    await readFile(
      join(destination, "resources/licenses/DiskPond-AGPL-3.0.txt"),
      "utf8",
    ),
    await readFile("LICENSE", "utf8"),
  );
  assert.equal(
    await readFile(
      join(destination, "resources/licenses/core-Apache-2.0.txt"),
      "utf8",
    ),
    await readFile("apps/core/LICENSE", "utf8"),
  );
  const update = await readFile(
    join(destination, "resources/app-update.yml"),
    "utf8",
  );
  assert.match(update, /owner: hoxsec/);
  assert.match(update, /repo: DiskPond/);
  client.close();
  client = null;
  await mainClient.call("Runtime.evaluate", {
    expression:
      "setTimeout(() => process.getBuiltinModule('module').createRequire(process.execPath)('electron').app.quit(), 200)",
  });
  mainClient.close();
  mainClient = null;
  await Promise.race([
    new Promise((ok, fail) =>
      child.once("exit", (code) =>
        code === 0 ? ok() : fail(new Error(`App quit ${code}`)),
      ),
    ),
    delay(10_000).then(() => {
      throw new Error("Packaged app did not quit");
    }),
  ]);
  console.info(
    "Installed NSIS smoke passed: first launch, local onboarding, IPC version, packaged engine discovery, project licenses, DiskPond updater metadata and normal quit.",
  );
} finally {
  client?.close();
  mainClient?.close();
  stop(child);
  if (installed) {
    await run(
      join(destination, "Uninstall DiskPond.exe"),
      ["/S", `_?=${destination}`],
      { timeout: 180_000 },
    );
    assert.equal(existsSync(join(destination, "DiskPond.exe")), false);
    // Inherited uninstall does not remove the entries registered by the app.
    // Record this M5 gap and remove only registrations pointing to this fixture.
    const startup = spawnSync("reg", ["query", startupKey, "/v", "DiskPond"], {
      encoding: "utf8",
    });
    if (startup.status === 0) {
      assert.ok(startup.stdout.includes(destination));
      assert.equal(
        spawnSync("reg", ["delete", startupKey, "/v", "DiskPond", "/f"]).status,
        0,
      );
      console.info(
        "Recorded inherited uninstall gap: startup entry needed fixture cleanup.",
      );
    }
    const scheme = spawnSync(
      "reg",
      ["query", `${schemeKey}\\shell\\open\\command`, "/ve"],
      { encoding: "utf8" },
    );
    if (scheme.status === 0) {
      assert.ok(scheme.stdout.includes(destination));
      assert.equal(spawnSync("reg", ["delete", schemeKey, "/f"]).status, 0);
      console.info(
        "Recorded inherited uninstall gap: URI registration needed fixture cleanup.",
      );
    }
  }
  assert.equal(await readFile(join(data, ".m1-fixture"), "utf8"), temp);
  await rm(data, { recursive: true, force: true, maxRetries: 10 });
  if (!updaterExisted)
    await rm(updaterCache, { recursive: true, force: true, maxRetries: 10 });
  await rm(temp, { recursive: true, force: true, maxRetries: 10 });
  console.info("Installed smoke fixture uninstalled and removed.");
}
