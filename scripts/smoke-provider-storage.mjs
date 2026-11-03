import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  assertNoCredentials,
  scanCredentials,
} from "./lib/credential-scan.mjs";
import {
  completed,
  electronDirectory,
  launch,
  pnpm,
  root,
  run,
  stop,
} from "./lib/process.mjs";

const secrets = [
  "DiskPond-provider-fixture-0",
  "DiskPond-provider-fixture-1",
  " DiskPond-vault-fixture-雪-0 ",
  "DiskPond-vault-fixture-雪-1",
];

const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-provider-"),
);
const require = createRequire(resolve(electronDirectory, "package.json"));
const bundle = resolve(electronDirectory, "build/provider-fixture.mjs");
const binary = join(
  directory,
  process.platform === "win32" ? "webdav.exe" : "webdav",
);
let service, child;
try {
  await run(
    process.env.GO_BINARY || "go",
    ["build", "-o", binary, "./tests/tools/diskpond-webdav"],
    { cwd: resolve(root, "apps/core") },
  );
  service = launch(binary, [], {
    stdio: ["ignore", "pipe", "inherit"],
    env: {
      ...process.env,
      DISKPOND_WEBDAV_ROOT: join(directory, "storage"),
      DISKPOND_PROVIDER_SECRET_0: "DiskPond-provider-fixture-0",
      DISKPOND_PROVIDER_SECRET_1: "DiskPond-provider-fixture-1",
    },
  });
  const [address] = await once(service.stdout, "data", {
    signal: AbortSignal.timeout(15_000),
  });
  const url = address.toString().trim();
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url))
    throw new Error("Invalid fixture address");
  await completed(
    pnpm(["--filter", "@blinkdisk/electron", "exec", "install-electron"]),
  );
  const { build } = require("esbuild");
  const { TsconfigPathsPlugin } = require("@esbuild-plugins/tsconfig-paths");
  await build({
    absWorkingDir: electronDirectory,
    entryPoints: [resolve(root, "scripts/lib/provider-fixture.mjs")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["electron"],
    plugins: [
      TsconfigPathsPlugin({
        tsconfig: resolve(electronDirectory, "tsconfig.json"),
      }),
    ],
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
  async function phase(mode, phase, profile = mode) {
    // WebDAV's repository root must exist; only its contents belong to Kopia.
    for (let index = 0; index < 2; index++)
      await mkdir(join(directory, "storage", profile, `repo-${index}`), {
        recursive: true,
      });
    child = launch(require("electron"), [bundle], {
      cwd: electronDirectory,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 195_000,
      env: {
        ...process.env,
        DISKPOND_DATA_DIR: join(directory, "profiles", profile),
        DISKPOND_PROVIDER_PHASE: phase,
        DISKPOND_PROVIDER_MODE: mode,
        DISKPOND_PROVIDER_NAMESPACE: profile,
        DISKPOND_PROVIDER_ROOT: directory,
        DISKPOND_WEBDAV_URL: url,
        KOPIA_LOG_DIR: join(directory, "profiles", profile, "engine-logs"),
        KOPIA_CHECK_FOR_UPDATES: "false",
        // The engine derives a separate cache from each config path by default.
        KOPIA_CACHE_DIRECTORY: "",
        TMP: join(directory, "tmp"),
        TEMP: join(directory, "tmp"),
      },
    });
    const chunks = [];
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (data) => chunks.push(data));
    try {
      await completed(child);
    } finally {
      const output = Buffer.concat(chunks).toString("utf8");
      assertNoCredentials(
        Buffer.from(output),
        secrets,
        "captured process output",
      );
      process.stdout.write(output);
    }
    if (phase !== "seed-legacy") await scanCredentials(directory, secrets);
  }
  await mkdir(join(directory, "tmp"));
  for (const mode of ["protected", "session", "failure", "write-failure"]) {
    await phase(mode, "create");
    await phase(mode, "restart");
  }
  await phase("protected", "seed-legacy");
  await phase("protected", "migrate");
  await phase("protected", "migrated-restart");
  await phase("locked", "restart", "protected");
  console.info(
    "Provider smoke passed: credential-isolated WebDAV, wrong/swapped-credential rejection, two independent vaults, two-version snapshots and terminal-success restores with hashes, application/engine restart, exact passwords, native protected/session/failure modes, both legacy migrations with protected restart, and live/post-exit credential scans.",
  );
} finally {
  stop(child);
  stop(service);
  await rm(bundle, { force: true });
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
