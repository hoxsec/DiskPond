import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  completed,
  electronDirectory,
  launch,
  pnpm,
  root,
  stop,
} from "./lib/process.mjs";

const mode = process.argv[2];
const appRequire = createRequire(resolve(electronDirectory, "package.json"));
const children = new Set();
let stopping = false;

function cleanup() {
  stopping = true;
  for (const child of children) stop(child);
}

process.once("SIGINT", () => {
  cleanup();
  process.exitCode = 130;
});
process.once("SIGTERM", () => {
  cleanup();
  process.exitCode = 143;
});
process.once("exit", cleanup);

function track(child) {
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

async function command(args) {
  await completed(track(pnpm(args)));
}

async function ensureElectron() {
  await command([
    "--filter",
    "@blinkdisk/electron",
    "exec",
    "install-electron",
  ]);
  return appRequire("electron");
}

async function build(packaging = false) {
  await command(["run", "build:core", ...(packaging ? ["--package"] : [])]);
  await command(["--filter", "@blinkdisk/electron", "run", "prebuild"]);
}

async function develop() {
  await command(["run", "build:core"]);
  const executable = await ensureElectron();
  await command(["--filter", "@blinkdisk/electron", "run", "compile:once"]);

  const renderer = track(
    pnpm(["--filter", "@blinkdisk/desktop", "run", "dev"]),
  );
  const compiler = track(
    pnpm(["--filter", "@blinkdisk/electron", "run", "compile:dev"]),
  );
  const failures = [renderer, compiler].map((child) =>
    completed(child).then(() => {
      if (!stopping)
        throw new Error("A development server exited unexpectedly.");
    }),
  );

  const ready = async () => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (stopping) return;
      try {
        const response = await fetch("http://127.0.0.1:3002", {
          signal: AbortSignal.timeout(500),
        });
        if (response.ok) return;
      } catch {
        // Vite is still starting; child failures are monitored separately.
      }
      await delay(250);
    }
    throw new Error("The renderer did not start on http://127.0.0.1:3002.");
  };

  await Promise.race([ready(), ...failures]);
  if (stopping) return;
  const smoke = process.argv.includes("--smoke");
  const electron = track(
    launch(executable, [
      smoke ? resolve(root, "scripts/smoke-electron.cjs") : electronDirectory,
    ]),
  );
  await Promise.race([completed(electron), ...failures]);
}

try {
  if (mode === "dev") {
    await develop();
  } else if (mode === "build") {
    await build();
  } else if (["windows", "linux", "macos"].includes(mode)) {
    const platform = { windows: "win32", linux: "linux", macos: "darwin" }[
      mode
    ];
    if (
      process.platform !== platform ||
      (mode === "windows" && process.arch !== "x64")
    ) {
      throw new Error(
        `Build ${mode} packages on ${platform}${mode === "windows" ? " x64" : ""}.`,
      );
    }
    await build(true);
    await command([
      "--filter",
      "@blinkdisk/electron",
      "run",
      `build:${mode}`,
      "--publish",
      "never",
      ...process.argv.slice(3),
    ]);
  } else if (mode === "preview") {
    const executable = await ensureElectron();
    if (!existsSync(resolve(electronDirectory, "frontend/index.html"))) {
      throw new Error("Run pnpm build:desktop before pnpm preview:desktop.");
    }
    await completed(
      track(
        launch(executable, [electronDirectory], {
          env: { ...process.env, DISKPOND_PREVIEW: "1" },
        }),
      ),
    );
  } else {
    throw new Error(`Unknown desktop command: ${mode}`);
  }
} catch (error) {
  if (!stopping) {
    console.error(error.message);
    process.exitCode = 1;
  }
} finally {
  cleanup();
}
