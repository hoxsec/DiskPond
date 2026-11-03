import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { coreBuildTarget } from "../libs/constants/src/core.ts";
import {
  completed,
  electronDirectory,
  launch,
  pnpm,
  root,
  run,
  stop,
} from "./lib/process.mjs";

const baselineRevision = "e8955e7280edd9526b9f104f1592f233cfe6789b";
const coreDirectory = resolve(root, "apps/core");
const target = coreBuildTarget(process.platform, process.arch);
const core = resolve(
  coreDirectory,
  "dist",
  target.directory,
  target.executable,
);
const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-discovery-"),
);
const baselineSource = join(directory, "baseline-source");
let baseline = process.env.DISKPOND_BASELINE_CORE;
let addedWorktree = false;
let child;
const bundle = resolve(electronDirectory, "build/discovery-fixture.mjs");
const password = "DiskPond-discovery-fixture-only-雪";
const require = createRequire(resolve(electronDirectory, "package.json"));

function cli(binary, name, args) {
  return execFileSync(
    binary,
    [
      "--config-file",
      join(directory, `${name}.config`),
      "--no-persist-credentials",
      "--disable-repository-log",
      ...args,
    ],
    {
      encoding: "utf8",
      timeout: 90_000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        KOPIA_PASSWORD: password,
        KOPIA_CHECK_FOR_UPDATES: "false",
        KOPIA_CACHE_DIRECTORY: join(directory, "cache", name),
        KOPIA_LOG_DIR: join(directory, "logs", name),
      },
    },
  );
}

async function hashes(path, prefix = "") {
  const result = {};
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const key = `${prefix}${entry.name}`;
    const file = join(path, entry.name);
    if (entry.isDirectory()) {
      result[`${key}/`] = "directory";
      Object.assign(result, await hashes(file, `${key}/`));
    } else
      result[key] = createHash("sha256")
        .update(await readFile(file))
        .digest("hex");
  }
  return result;
}

try {
  if (!baseline) {
    await run(
      "git",
      ["worktree", "add", "--detach", baselineSource, baselineRevision],
      { cwd: coreDirectory },
    );
    addedWorktree = true;
    baseline = join(directory, target.executable);
    await run(
      process.env.GO_BINARY || "go",
      [
        "build",
        "-trimpath",
        "-ldflags",
        `-s -w -X github.com/kopia/kopia/repo.BuildInfo=${baselineRevision} -X github.com/kopia/kopia/repo.BuildGitHubRepo=blinkdisk/core`,
        "-o",
        baseline,
        ".",
      ],
      { cwd: baselineSource, timeout: 180_000 },
    );
  }
  const baselineVersion = execFileSync(baseline, ["--version"], {
    encoding: "utf8",
  }).trim();
  assert.ok(baselineVersion.includes(`build: ${baselineRevision} from:`));
  console.info(`Baseline: ${baselineVersion}`);
  console.info(
    `Candidate: ${execFileSync(core, ["--version"], { encoding: "utf8" }).trim()}`,
  );

  const source = join(directory, "source");
  await mkdir(join(source, "nested", "空"), { recursive: true });
  await writeFile(join(source, "version.txt"), "version A\n");
  await writeFile(join(source, "deleted.txt"), "restore this deleted file\n");
  await writeFile(join(source, "empty.txt"), "");
  await writeFile(join(source, "nested", "雪.txt"), "Unicode fixture\n");
  await writeFile(
    join(source, "nested", "large.bin"),
    Buffer.alloc(2 ** 20, 37),
  );
  const repository = join(directory, "baseline-repository");
  await mkdir(repository);
  // Use the legacy layout so removing .shards models a readable pre-marker
  // repository, rather than corrupting a newer {1,3} layout.
  await writeFile(
    join(repository, ".shards"),
    JSON.stringify({ default: [3, 3], maxNonShardedLength: 20 }),
  );
  cli(baseline, "baseline", [
    "repo",
    "create",
    "filesystem",
    "--path",
    repository,
  ]);
  const expectedA = await hashes(source);
  const snapshotA = JSON.parse(
    cli(baseline, "baseline", ["snapshot", "create", source, "--json"]),
  );
  await writeFile(
    join(source, "version.txt"),
    "version B with different data\n",
  );
  await rm(join(source, "deleted.txt"));
  await writeFile(join(source, "added.txt"), "only in B\n");
  const expectedB = await hashes(source);
  const snapshotB = JSON.parse(
    cli(baseline, "baseline", [
      "snapshot",
      "create",
      source,
      "--json",
      "--force-hash=100",
    ]),
  );
  assert.ok(snapshotA.id && snapshotB.id && snapshotA.id !== snapshotB.id);
  // Isolate connection/migration writes from scheduled maintenance in copies.
  cli(baseline, "baseline", [
    "maintenance",
    "set",
    "--enable-quick=false",
    "--enable-full=false",
  ]);
  const { uniqueID } = JSON.parse(
    await readFile(join(repository, "kopia.repository.f"), "utf8"),
  );
  const cases = [];
  for (const name of [
    "current",
    "legacy",
    "current-no-shards",
    "legacy-no-shards",
    "empty",
    "missing",
    "unrelated",
    "invalid-current",
  ]) {
    const parent = join(directory, "cases", name);
    const path = join(parent, "repository");
    await mkdir(parent, { recursive: true });
    let code;
    if (["empty", "missing", "unrelated"].includes(name)) {
      code = name === "missing" ? "INTERNAL" : "NOT_INITIALIZED";
      if (name !== "missing") await mkdir(path);
      if (name === "unrelated")
        await writeFile(join(path, "keep.txt"), "unrelated data");
    } else {
      await cp(repository, path, { recursive: true });
      if (name.startsWith("legacy"))
        for (const suffix of ["repository", "blobcfg"])
          await rename(
            join(path, `kopia.${suffix}.f`),
            join(path, `blinkdisk.${suffix}.f`),
          );
      if (name.startsWith("legacy")) {
        const file = join(path, "blinkdisk.repository.f");
        await writeFile(
          file,
          (await readFile(file, "utf8")).replaceAll(
            "https://github.com/kopia/kopia",
            "https://github.com/blinkdisk/core",
          ),
        );
      }
      if (name.endsWith("no-shards")) await rm(join(path, ".shards"));
      if (name === "invalid-current") {
        code = "INTERNAL";
        await cp(
          join(path, "kopia.repository.f"),
          join(path, "blinkdisk.repository.f"),
        );
        await writeFile(join(path, "kopia.repository.f"), "{invalid");
      }
    }
    cases.push({ name, parent, path, code });
  }
  const fixture = join(directory, "fixture.json");
  await writeFile(
    fixture,
    JSON.stringify({
      cases,
      uniqueID,
      password,
      versions: [
        {
          id: snapshotA.id,
          rootID: snapshotA.rootEntry.obj,
          hashes: expectedA,
        },
        {
          id: snapshotB.id,
          rootID: snapshotB.rootEntry.obj,
          hashes: expectedB,
        },
      ],
    }),
  );
  await completed(
    pnpm(["--filter", "@blinkdisk/electron", "exec", "install-electron"]),
  );
  const { build } = require("esbuild");
  const { TsconfigPathsPlugin } = require("@esbuild-plugins/tsconfig-paths");
  await build({
    absWorkingDir: electronDirectory,
    entryPoints: [resolve(root, "scripts/lib/discovery-fixture.mjs")],
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
  for (const phase of ["connect", "restart"]) {
    child = launch(require("electron"), [bundle], {
      cwd: electronDirectory,
      env: {
        ...process.env,
        DISKPOND_DATA_DIR: join(directory, "app-data"),
        DISKPOND_DISCOVERY_FIXTURE: fixture,
        DISKPOND_DISCOVERY_PHASE: phase,
        KOPIA_CHECK_FOR_UPDATES: "false",
        KOPIA_CACHE_DIRECTORY: join(directory, "discovery-cache"),
        KOPIA_LOG_DIR: join(directory, "discovery-logs"),
      },
      timeout: 240_000,
    });
    await completed(child);
  }

  // Explicit connection is separate from discovery and can write repository
  // metadata. Each CLI invocation restarts the process with its saved config.
  for (const item of cases.filter((item) => !item.code)) {
    cli(core, item.name, [
      "repo",
      "connect",
      "filesystem",
      "--path",
      item.path,
    ]);
    for (const [snapshot, expected] of [
      [snapshotA, expectedA],
      [snapshotB, expectedB],
    ]) {
      const destination = join(directory, "restored", item.name, snapshot.id);
      cli(core, item.name, ["snapshot", "restore", snapshot.id, destination]);
      assert.deepEqual(await hashes(destination), expected);
    }
    console.info(`Two-version restore/hash comparison passed: ${item.name}`);
    if (item.name.startsWith("legacy")) {
      // The original pinned client must still recover after explicit migration.
      cli(baseline, `old-${item.name}`, [
        "repo",
        "connect",
        "filesystem",
        "--path",
        item.path,
      ]);
      for (const [snapshot, expected] of [
        [snapshotA, expectedA],
        [snapshotB, expectedB],
      ]) {
        const destination = join(
          directory,
          "restored-old",
          item.name,
          snapshot.id,
        );
        cli(baseline, `old-${item.name}`, [
          "snapshot",
          "restore",
          snapshot.id,
          destination,
        ]);
        assert.deepEqual(await hashes(destination), expected);
      }
    }
  }
  console.info(
    "Discovery smoke passed: eight destinations, exact identity/password checks, unchanged file trees and metadata, and both baseline snapshot versions restored from four compatible copies.",
  );
} finally {
  stop(child);
  await rm(bundle, { force: true });
  if (addedWorktree)
    await run("git", ["worktree", "remove", baselineSource], {
      cwd: coreDirectory,
    });
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
