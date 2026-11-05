import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { updateMetadataName } from "../../libs/constants/src/update.ts";
import { electronDirectory } from "./process.mjs";

const { parse } = createRequire(join(electronDirectory, "package.json"))(
  "yaml",
);

export function releaseVersion(tag, refType) {
  assert.equal(refType, "tag", "Release assets require a tag");
  assert.match(
    tag ?? "",
    /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(alpha|beta|rc)\.(0|[1-9][0-9]*))?$/,
    "Expected vMAJOR.MINOR.PATCH[-alpha.N|-beta.N|-rc.N]",
  );
  return tag.slice(1);
}

// electron-builder uses distribution-specific architecture names in filenames.
const feeds = {
  windows: {
    [updateMetadataName("win32", "x64")]: ["DiskPond-Windows.exe"],
  },
  macos: {
    [updateMetadataName("darwin", "arm64")]: [
      "DiskPond-macOS.zip",
      "DiskPond-macOS.dmg",
    ],
  },
  linux: {
    [updateMetadataName("linux", "x64")]: [
      "DiskPond-Linux-x86_64.AppImage",
      "DiskPond-Linux-amd64.deb",
      "DiskPond-Linux-x86_64.rpm",
    ],
    [updateMetadataName("linux", "arm64")]: [
      "DiskPond-Linux-arm64.AppImage",
      "DiskPond-Linux-arm64.deb",
      "DiskPond-Linux-aarch64.rpm",
    ],
    [updateMetadataName("linux", "arm")]: [
      "DiskPond-Linux-armv7l.AppImage",
      "DiskPond-Linux-armv7l.deb",
      "DiskPond-Linux-armv7l.rpm",
    ],
  },
};

export function releaseFiles(platform) {
  assert.ok(feeds[platform], `Unknown release platform: ${platform}`);
  return Object.entries(feeds[platform]).flatMap(([metadata, files]) => [
    metadata,
    ...files,
    ...(platform === "linux" ? [] : files.map((file) => `${file}.blockmap`)),
  ]);
}

export async function hashFile(path, algorithm, encoding) {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest(encoding);
}

export async function validateAssets(directory, platform, version) {
  const files = releaseFiles(platform);
  for (const name of files) {
    const info = await stat(join(directory, name));
    assert.ok(
      info.isFile() && info.size > 0,
      `Empty or missing asset: ${name}`,
    );
  }
  for (const [name, expected] of Object.entries(feeds[platform])) {
    const metadata = parse(await readFile(join(directory, name), "utf8"), {
      maxAliasCount: 0,
    });
    assert.equal(metadata.version, version, `Updater version differs: ${name}`);
    assert.ok(Array.isArray(metadata.files), `Missing updater files: ${name}`);
    assert.deepEqual(
      metadata.files.map((file) => file.url).sort(),
      [...expected].sort(),
      `Updater assets differ: ${name}`,
    );
    for (const file of metadata.files) {
      const path = join(directory, file.url);
      assert.equal(
        file.sha512,
        await hashFile(path, "sha512", "base64"),
        `Updater hash differs: ${file.url}`,
      );
      if (file.size !== undefined)
        assert.equal(
          file.size,
          (await stat(path)).size,
          `Wrong size: ${file.url}`,
        );
    }
    const primary = metadata.files.find((file) => file.url === metadata.path);
    assert.ok(primary, `Missing primary updater asset: ${name}`);
    assert.equal(
      metadata.sha512,
      primary.sha512,
      `Primary hash differs: ${name}`,
    );
  }
  return files;
}

export async function stageAssets(directory, output, platform, version) {
  const files = await validateAssets(directory, platform, version);
  await mkdir(output, { recursive: true });
  assert.deepEqual(
    await readdir(output),
    [],
    "Asset staging directory must be empty",
  );
  for (const name of files)
    await copyFile(join(directory, name), join(output, name));
}
