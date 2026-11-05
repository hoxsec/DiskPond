import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { electronDirectory, root } from "./lib/process.mjs";

const appRequire = createRequire(join(electronDirectory, "package.json"));
const builderRequire = createRequire(appRequire.resolve("electron-builder"));
const { listPackage, extractFile } = createRequire(
  builderRequire.resolve("app-builder-lib"),
)("@electron/asar");
const version =
  process.env.GITHUB_REF_TYPE === "tag"
    ? process.env.GITHUB_REF_NAME.replace(/^v/, "")
    : appRequire("./package.json").version;
const packages = {
  win32: [["x64", "win-unpacked/resources"]],
  darwin: [["universal", "mac-universal/DiskPond.app/Contents/Resources"]],
  linux: [
    ["x64", "linux-unpacked/resources"],
    ["arm64", "linux-arm64-unpacked/resources"],
    ["arm", "linux-armv7l-unpacked/resources"],
  ],
}[process.platform];
assert.ok(packages, `Unsupported package smoke platform: ${process.platform}`);
let nativeCore;
for (const [architecture, relative] of packages) {
  const resources = join(electronDirectory, "dist", relative);
  const archive = join(resources, "app.asar");
  const inventory = listPackage(archive).map((name) =>
    name.replaceAll("\\", "/").replace(/^\/+/, ""),
  );
  assert.deepEqual(
    [...new Set(inventory.map((name) => name.split("/")[0]))].sort(),
    ["build", "frontend", "package.json"],
  );
  for (const name of [
    "build/index.js",
    "build/preload.js",
    "frontend/index.html",
  ])
    assert.ok(inventory.includes(name), `Missing desktop input: ${name}`);
  assert.equal(
    JSON.parse(extractFile(archive, "package.json")).version,
    version,
  );
  const resourceInventory = (await readdir(resources, { recursive: true })).map(
    (name) => name.replaceAll("\\", "/"),
  );
  assert.deepEqual(
    [...inventory, ...resourceInventory].filter((name) =>
      /(^|\/)(marketing|site|_astro|docs|website\.json)(\/|$)/i.test(name),
    ),
    [],
    "Website files must not be included in desktop packages",
  );
  for (const [packaged, source] of [
    ["assets/icon.png", "apps/electron/icon/icon.png"],
    ["licenses/DiskPond-AGPL-3.0.txt", "LICENSE"],
    ["licenses/core-Apache-2.0.txt", "apps/core/LICENSE"],
    ["licenses/UPSTREAM.txt", "UPSTREAM.txt"],
  ])
    assert.ok(
      (await readFile(join(resources, packaged))).equals(
        await readFile(join(root, source)),
      ),
      `Packaged resource differs from source: ${packaged}`,
    );
  const update = await readFile(join(resources, "app-update.yml"), "utf8");
  assert.match(update, /owner: hoxsec/);
  assert.match(update, /repo: DiskPond/);
  const core = join(
    resources,
    "binaries",
    process.platform === "win32" ? "kopia.exe" : "kopia",
  );
  if (process.platform === "linux") {
    await access(core, constants.X_OK);
    const file = await open(core);
    try {
      const header = Buffer.alloc(20);
      await file.read(header, 0, header.length, 0);
      assert.equal(header.subarray(0, 4).toString(), "\x7fELF");
      assert.equal(header[5], 1, "Expected little-endian ELF");
      assert.equal(
        header.readUInt16LE(18),
        { x64: 62, arm64: 183, arm: 40 }[architecture],
      );
    } finally {
      await file.close();
    }
  }
  if (process.platform === "darwin") {
    execFileSync("lipo", ["-verify_arch", "x86_64", "arm64", core]);
    execFileSync("lipo", [
      "-verify_arch",
      "x86_64",
      "arm64",
      join(resources, "../MacOS/DiskPond"),
    ]);
    execFileSync("codesign", [
      "--verify",
      "--deep",
      "--strict",
      join(resources, "../.."),
    ]);
  }
  if (architecture === process.arch || architecture === "universal")
    nativeCore = core;
  console.info(
    `Packaged ${process.platform}/${architecture}: version, contents, licenses and engine architecture passed`,
  );
}
assert.ok(nativeCore, "No native packaged engine found");
execFileSync(nativeCore, ["--version"], { stdio: "inherit", timeout: 30_000 });

const temp = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-package-"),
);
try {
  const cli = (args) =>
    execFileSync(
      nativeCore,
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
          KOPIA_PASSWORD: "package-disposable-fixture-only",
          KOPIA_CHECK_FOR_UPDATES: "false",
          KOPIA_CACHE_DIRECTORY: join(temp, "cache"),
          KOPIA_LOG_DIR: join(temp, "logs"),
        },
      },
    );
  const source = join(temp, "source");
  const destination = join(temp, "repository");
  await mkdir(source);
  await mkdir(destination);
  await writeFile(join(source, "雪.txt"), "Packaged recovery fixture\n");
  await writeFile(join(source, "empty.txt"), "");
  const hash = async (path) =>
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  const expected = await hash(join(source, "雪.txt"));
  cli(["repo", "create", "filesystem", "--path", destination]);
  const snapshot = JSON.parse(cli(["snapshot", "create", source, "--json"]));
  assert.ok(snapshot.id);
  await rm(source, { recursive: true });
  const restored = join(temp, "restored");
  cli(["snapshot", "restore", snapshot.id, restored]);
  assert.deepEqual((await readdir(restored)).sort(), ["empty.txt", "雪.txt"]);
  assert.equal(await hash(join(restored, "雪.txt")), expected);
  assert.equal(await readFile(join(restored, "empty.txt"), "utf8"), "");
  console.info("Packaged native engine backup/restore hashes passed");
} finally {
  await rm(temp, { recursive: true, force: true, maxRetries: 5 });
}
