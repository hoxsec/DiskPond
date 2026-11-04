import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import { installedUpdateProbe } from "./lib/installed-update.mjs";
import { root as repository, run, stop } from "./lib/process.mjs";

assert.equal(process.platform, "win32", "Installed smoke requires Windows.");
const data = join(process.env.APPDATA, "diskpond");
const updaterCache = join(process.env.LOCALAPPDATA, "diskpond-updater");
const updaterExisted = existsSync(updaterCache);
assert.equal(
  updaterExisted,
  false,
  "An updater cache exists; use an isolated Windows user for this test.",
);
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
let updateProbe;

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
  // Verify installer replacement from the previous public release, including
  // its existing preference-file shape, before probing the new updater itself.
  const previous = await fetch(
    "https://github.com/hoxsec/DiskPond/releases/download/v0.1.2/DiskPond-Windows.exe",
    { signal: AbortSignal.timeout(120_000) },
  );
  assert.equal(previous.ok, true);
  const previousBytes = Buffer.from(await previous.arrayBuffer());
  assert.equal(
    createHash("sha256").update(previousBytes).digest("hex"),
    "727653b49bae830adbae6a2a697911d8ec92e89e45fb62e1f65bb960257b35cf",
  );
  const previousPath = join(temp, "DiskPond-v0.1.2.exe");
  await writeFile(previousPath, previousBytes);
  await run(previousPath, ["/S", `/D=${destination}`], { timeout: 180_000 });
  installed = true;
  await writeFile(
    join(data, "config.json"),
    JSON.stringify({ preferences: { theme: "dark", checkForUpdates: false } }),
  );
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
  assert.equal(
    await evaluate("window.electron.app.version()"),
    process.env.GITHUB_REF_TYPE === "tag"
      ? process.env.GITHUB_REF_NAME.replace(/^v/, "")
      : JSON.parse(
          await readFile(
            join(repository, "apps/electron/package.json"),
            "utf8",
          ),
        ).version,
  );
  // Inspect the actual installed ASAR through Electron's filesystem support.
  // Website source, build output and screenshots belong only in source assets.
  const packageInventory = await mainClient.call("Runtime.evaluate", {
    expression: `(() => {
      const fs = process.getBuiltinModule('fs');
      const path = process.getBuiltinModule('path');
      return {
        archive: fs.readdirSync(path.join(process.resourcesPath, 'app.asar'), {recursive: true}).map(name => name.split(path.sep).join('/')),
        resourceRoots: fs.readdirSync(process.resourcesPath).sort(),
        resources: fs.readdirSync(process.resourcesPath, {recursive: true}).map(name => name.split(path.sep).join('/'))
      };
    })()`,
    returnByValue: true,
  });
  assert.equal(packageInventory.exceptionDetails, undefined);
  const inventory = packageInventory.result.value;
  assert.deepEqual(
    [...new Set(inventory.archive.map((name) => name.split("/")[0]))].sort(),
    ["build", "frontend", "package.json"],
  );
  assert.deepEqual(inventory.resourceRoots, [
    "app-update.yml",
    "app.asar",
    "assets",
    "binaries",
    "elevate.exe",
    "licenses",
  ]);
  for (const required of [
    "build/index.js",
    "build/preload.js",
    "frontend/index.html",
  ])
    assert.ok(
      inventory.archive.includes(required),
      `Missing desktop input: ${required}`,
    );
  assert.deepEqual(
    [...inventory.archive, ...inventory.resources].filter((name) =>
      /(^|\/)(marketing|site|_astro|docs|website\.json)(\/|$)/i.test(name),
    ),
    [],
    "Website files must not be included in the desktop installer",
  );
  console.info(
    `Installed package isolation passed: ${inventory.archive.length} ASAR entries; desktop-only roots and resources, no website files.`,
  );
  assert.equal(
    await evaluate("window.electron.store.get('preferences.theme')"),
    "dark",
  );
  console.info("Installed v0.1.2-to-candidate upgrade retained preferences.");
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
  // Exercise the actual installed engine with a disposable repository.
  const core = join(destination, "resources/binaries/kopia.exe");
  const cli = (args) =>
    execFileSync(
      core,
      [
        "--config-file",
        join(temp, "recovery.config"),
        "--no-persist-credentials",
        "--disable-repository-log",
        ...args,
      ],
      {
        encoding: "utf8",
        timeout: 90_000,
        env: {
          ...process.env,
          KOPIA_PASSWORD: "installed-disposable-fixture-only",
          KOPIA_CHECK_FOR_UPDATES: "false",
          KOPIA_CACHE_DIRECTORY: join(temp, "cache"),
          KOPIA_LOG_DIR: join(temp, "logs"),
        },
      },
    );
  const source = join(temp, "source");
  await mkdir(source);
  await writeFile(join(source, "雪.txt"), "Installed recovery fixture\n");
  await writeFile(join(source, "empty.txt"), "");
  const hash = async (path) =>
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  const expected = await hash(join(source, "雪.txt"));
  cli(["repo", "create", "filesystem", "--path", probe]);
  const snapshot = JSON.parse(cli(["snapshot", "create", source, "--json"]));
  assert.ok(snapshot.id);
  await rm(source, { recursive: true });
  const restored = join(temp, "restored");
  cli(["snapshot", "restore", snapshot.id, restored]);
  assert.deepEqual((await readdir(restored)).sort(), ["empty.txt", "雪.txt"]);
  assert.equal(await hash(join(restored, "雪.txt")), expected);
  assert.equal(await readFile(join(restored, "empty.txt"), "utf8"), "");
  console.info("Installed bundled-engine backup/restore hashes passed.");
  updateProbe = await installedUpdateProbe({
    dist: resolve(repository, "apps/electron/dist"),
    destination,
    data,
    evaluate,
    mainClient,
  });
  await updateProbe.prepare();
  client.close();
  client = null;
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
  await updateProbe.verifyRelaunch();
  const restoredAfterUpdate = join(temp, "restored-after-update");
  cli(["snapshot", "restore", snapshot.id, restoredAfterUpdate]);
  assert.equal(await hash(join(restoredAfterUpdate, "雪.txt")), expected);
  console.info(
    "Installed NSIS smoke passed: upgrade, onboarding, IPC version, engine discovery, licenses, in-app download/install/relaunch and post-update recovery hash.",
  );
} finally {
  client?.close();
  mainClient?.close();
  stop(child);
  await updateProbe?.dispose();
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
