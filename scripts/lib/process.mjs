import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const electronDirectory = resolve(root, "apps/electron");

export function launch(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options,
  });
}

export function completed(child) {
  return new Promise((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Command exited with ${signal || code}`));
    });
  });
}

export function run(command, args, options) {
  return completed(launch(command, args, options));
}

export function pnpm(args, options = {}) {
  let executable = process.env.npm_execpath;
  const runtime = process.env.npm_node_execpath;
  // Nested standalone invocations may report only the PATH command name.
  if (
    (executable === "pnpm" || executable === "pnpm.exe") &&
    runtime &&
    basename(runtime).toLowerCase() === "pnpm.exe"
  ) {
    executable = runtime;
  }
  if (!executable || !existsSync(executable)) {
    throw new Error("Run this command through pnpm (or corepack pnpm).");
  }
  // Standalone Windows pnpm embeds its runtime; it is not a Node script.
  return /\.exe$/i.test(executable)
    ? launch(executable, args, options)
    : launch(process.execPath, [executable, ...args], options);
}

export function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}
