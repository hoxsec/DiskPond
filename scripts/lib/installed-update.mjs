import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Test-only network routing lives in the installed process's inspector. The
// production app still accepts only its fixed GitHub feed and named IPC methods.
export async function installedUpdateProbe({
  dist,
  destination,
  data,
  evaluate,
  mainClient,
}) {
  const target = "99.0.0";
  const metadata = (await readFile(join(dist, "latest.yml"), "utf8")).replace(
    /^version: .+$/m,
    `version: ${target}`,
  );
  let installerRequests = 0;
  const server = createServer(async (request, response) => {
    try {
      const name = new URL(request.url, "http://localhost").pathname
        .split("/")
        .at(-1);
      if (name === "latest.yml") {
        response.end(metadata);
        return;
      }
      if (
        name !== "DiskPond-Windows.exe" &&
        name !== "DiskPond-Windows.exe.blockmap"
      ) {
        response.writeHead(404).end();
        return;
      }
      if (name === "DiskPond-Windows.exe") installerRequests++;
      const path = join(dist, name);
      const { size } = await stat(path);
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Number(range[2]) : size - 1;
      assert.ok(start >= 0 && end < size && start <= end);
      response.writeHead(range ? 206 : 200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": end - start + 1,
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
      });
      createReadStream(path, { start, end }).pipe(response);
    } catch {
      response.destroy();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  const processCommand = `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${join(destination, "DiskPond.exe").replaceAll("'", "''")}' }`;
  return {
    async prepare() {
      // Drain any startup check before replacing only the fixture's feed.
      await evaluate("window.electron.update.check().catch(() => null)");
      const injection = await mainClient.call("Runtime.evaluate", {
        expression: `(() => {
          const electron = process.getBuiltinModule('module').createRequire(process.execPath)('electron');
          const fetch = globalThis.fetch;
          globalThis.fetch = async (url, options) => {
            if (String(url).startsWith('https://api.github.com/repos/hoxsec/DiskPond/releases?')) return new Response(JSON.stringify([{ tag_name: 'v${target}', draft: false, prerelease: false, body: 'Installed updater fixture' }]));
            if (String(url) === 'https://github.com/hoxsec/DiskPond/releases/download/v${target}/latest.yml') return new Response(${JSON.stringify(metadata)});
            return fetch(url, options);
          };
          const request = electron.net.request.bind(electron.net);
          electron.net.request = (options) => {
            if (options.hostname === 'github.com' && options.path.startsWith('/hoxsec/DiskPond/releases/download/')) {
              options = { ...options, protocol: 'http:', hostname: '127.0.0.1', port: ${port} };
            }
            return request(options);
          };
        })()`,
      });
      assert.equal(injection.exceptionDetails, undefined);
      const available = await evaluate("window.electron.update.check()");
      assert.equal(available.version, target);
      assert.equal(available.available, true);
      await evaluate("window.electron.update.download()");
      for (let index = 0; index < 40; index++) {
        const status = await evaluate("window.electron.update.status()");
        assert.equal(status.phase, "ready");
        if (status.activity === "idle") break;
        await delay(250);
      }
      assert.equal(
        (await evaluate("window.electron.update.status()")).activity,
        "idle",
      );
      assert.ok(installerRequests > 0, "The real installer must be downloaded");
      await evaluate("window.electron.store.set('preferences.theme', 'dark')");
      // Let the harness detach both debuggers before the native quit begins.
      await evaluate(
        "setTimeout(() => void window.electron.update.install(), 250); true",
      );
    },
    async verifyRelaunch() {
      // The offered fixture version is deliberately newer than the actual
      // installer. A real relaunch must report NOT_INSTALLED, never false success.
      let state;
      for (let index = 0; index < 360; index++) {
        try {
          state = JSON.parse(await readFile(join(data, "config.json"), "utf8"));
        } catch {}
        if (state?.updates?.history?.[0]?.outcome === "NOT_INSTALLED") break;
        await delay(250);
      }
      assert.equal(state?.updates?.history?.[0]?.version, target);
      assert.equal(state?.updates?.history?.[0]?.outcome, "NOT_INSTALLED");
      assert.equal(state.preferences.theme, "dark");
      const pids = execFileSync(
        "pwsh",
        [
          "-NoProfile",
          "-Command",
          `${processCommand} | Select-Object -ExpandProperty ProcessId`,
        ],
        { encoding: "utf8" },
      );
      assert.match(pids, /\d+/, "Installer must relaunch the fixture app");
      console.info(
        "Installed in-app updater passed: real download/checksum, NSIS handoff, relaunch, retained settings and truthful unconfirmed-version history.",
      );
    },
    async dispose() {
      execFileSync("pwsh", [
        "-NoProfile",
        "-Command",
        `${processCommand} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ]);
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
