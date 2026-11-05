import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { root } from "./lib/process.mjs";
import {
  hashFile,
  releaseFiles,
  releaseVersion,
  stageAssets,
  validateAssets,
} from "./lib/release-assets.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    directory: { type: "string", default: "release-assets" },
    dist: { type: "string", default: "apps/electron/dist" },
  },
});
const [command, platform] = positionals;
const tag = process.env.GITHUB_REF_NAME;
const version = releaseVersion(tag, process.env.GITHUB_REF_TYPE);
const output = resolve(root, values.directory);
const git = (args, cwd = root) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

if (command === "validate") {
  console.info(`Validated release tag ${tag}`);
} else if (command === "stage") {
  await stageAssets(resolve(root, values.dist), output, platform, version);
  console.info(`Staged checked ${platform} assets for ${tag}`);
} else if (command === "finalize") {
  const platforms = ["windows", "linux", "macos"];
  assert.deepEqual(
    (await readdir(output)).sort(),
    platforms.flatMap(releaseFiles).sort(),
    "Release must contain exactly the checked assets from all three platforms",
  );
  for (const target of platforms) await validateAssets(output, target, version);
  const app = git(["rev-parse", "HEAD"]);
  const core = git(["rev-parse", "HEAD:apps/core"]);
  const coreDirectory = join(root, "apps/core");
  assert.equal(
    git(["rev-parse", "HEAD"], coreDirectory),
    core,
    "Core gitlink mismatch",
  );
  git([
    "archive",
    "--format=zip",
    `--output=${join(output, `DiskPond-${tag}-source.zip`)}`,
    "HEAD",
  ]);
  git(
    [
      "archive",
      "--format=zip",
      `--output=${join(output, `DiskPond-${tag}-core-source.zip`)}`,
      core,
    ],
    coreDirectory,
  );
  await copyFile(join(root, "LICENSE"), join(output, "LICENSE"));
  await copyFile(
    join(coreDirectory, "LICENSE"),
    join(output, "core-LICENSE.txt"),
  );
  let summary;
  try {
    summary = await readFile(join(root, "docs/releases", `${tag}.txt`), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    summary = "Encrypted desktop backups to storage you control.";
  }
  await writeFile(
    join(output, "RELEASE-NOTES.txt"),
    `# DiskPond ${tag} — Windows, Linux and macOS

${summary.trim()}

## Downloads

- Windows x64: DiskPond-Windows.exe.
- macOS Intel and Apple Silicon: DiskPond-macOS.dmg (universal); ZIP also available.
- Linux x64, ARM64 and ARMv7: AppImage, DEB and RPM. Choose the architecture matching your system.

Compare SHA256SUMS.txt with the downloaded assets. Windows and Linux packages are unsigned. macOS is ad-hoc signed, without Apple notarization.
Installation and build instructions: https://github.com/hoxsec/DiskPond/blob/${tag}/docs/desktop-release.txt

## Verification and source

Application source: ${app}
Core source: ${core} (hoxsec/diskpond-core)

The two source ZIPs contain the exact tracked application and core source. Extract the application ZIP, then the core ZIP into apps/core. Licenses, notices, pinned dependencies and build instructions are included. The Git-based build wrappers require a recursive clone of tag ${tag}; GitHub's automatic source archives alone omit the core submodule.

Release gates: lint, desktop types and unit tests on all three operating systems; native packaging; platform metadata version/SHA-512 validation; packaged contents and bundled-engine recovery hashes. Windows also checks installed replacement and in-app updater handoff/relaunch. Linux and macOS run the built desktop smoke. Linux ARM packages are cross-built and their bundled executable architectures checked; native ARM desktop execution is not covered by the x64 Linux runner.

Windows and Linux AppImage updates download inside DiskPond and offer explicit restart/install when native work is idle. macOS and Linux DEB/RPM installations open the matching release for manual installation. Versions through v0.1.2 need one manual Windows installer update to receive the updater.

DiskPond derives from BlinkDisk (AGPL-3.0); the Kopia-derived core retains Apache-2.0. See the LICENSE and core-LICENSE.txt release assets, plus UPSTREAM.txt inside the application source archive. Prior recovery evidence is retained in docs/verification.
`,
  );
  const sums = [];
  for (const name of (await readdir(output))
    .sort()
    .filter((name) => name !== "RELEASE-NOTES.txt"))
    sums.push(
      `${await hashFile(join(output, name), "sha256", "hex")}  ${name}`,
    );
  await writeFile(join(output, "SHA256SUMS.txt"), `${sums.join("\n")}\n`);
  console.info(`Finalized ${sums.length} checked release assets for ${tag}`);
} else {
  throw new Error(
    "Usage: release-assets.mjs validate | stage <windows|linux|macos> | finalize",
  );
}
