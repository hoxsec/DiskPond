import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  releaseFiles,
  releaseVersion,
  stageAssets,
  validateAssets,
} from "./release-assets.mjs";

test("release tags accept stable and numbered prereleases only", () => {
  for (const tag of [
    "v1.2.3",
    "v0.2.0-alpha.1",
    "v0.2.0-beta.0",
    "v0.2.0-rc.12",
  ])
    assert.equal(releaseVersion(tag, "tag"), tag.slice(1));
  for (const tag of [
    "main",
    "v01.2.3",
    "v1.2.3-rc.01",
    "v1.2.3-preview.1",
    "v1.2.3+build",
  ])
    assert.throws(() => releaseVersion(tag, "tag"));
  assert.throws(() => releaseVersion("v1.2.3", "branch"));
});

const platformFeeds = {
  windows: { "latest.yml": ["DiskPond-Windows.exe"] },
  macos: { "latest-mac.yml": ["DiskPond-macOS.zip", "DiskPond-macOS.dmg"] },
  linux: {
    "latest-linux.yml": [
      "DiskPond-Linux-x86_64.AppImage",
      "DiskPond-Linux-amd64.deb",
      "DiskPond-Linux-x86_64.rpm",
    ],
    "latest-linux-arm64.yml": [
      "DiskPond-Linux-arm64.AppImage",
      "DiskPond-Linux-arm64.deb",
      "DiskPond-Linux-aarch64.rpm",
    ],
    "latest-linux-arm.yml": [
      "DiskPond-Linux-armv7l.AppImage",
      "DiskPond-Linux-armv7l.deb",
      "DiskPond-Linux-armv7l.rpm",
    ],
  },
};
for (const [platform, feeds] of Object.entries(platformFeeds)) {
  test(`${platform}: stage only complete, version-matched, hash-checked assets`, async (t) => {
    const directory = await mkdtemp(
      join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-assets-"),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    const version = "0.2.0-rc.1";
    const metadata = {};
    for (const [name, assets] of Object.entries(feeds)) {
      const files = [];
      for (const url of assets) {
        const data = Buffer.from(`fixture ${url}`);
        await writeFile(join(directory, url), data);
        if (platform !== "linux")
          await writeFile(join(directory, `${url}.blockmap`), "blockmap");
        files.push({
          url,
          size: data.length,
          sha512: createHash("sha512").update(data).digest("base64"),
        });
      }
      metadata[name] = {
        version,
        files,
        path: files[0].url,
        sha512: files[0].sha512,
      };
      await writeFile(join(directory, name), JSON.stringify(metadata[name]));
    }
    // Builder debug files and unpacked apps must not leak into release assets.
    await writeFile(
      join(directory, "builder-debug.yml"),
      "private build paths",
    );
    const output = join(directory, "staged");
    await stageAssets(directory, output, platform, version);
    assert.deepEqual(
      (await readdir(output)).sort(),
      releaseFiles(platform).sort(),
    );
    await assert.rejects(
      stageAssets(directory, output, platform, version),
      /must be empty/,
    );
    await assert.rejects(
      validateAssets(directory, platform, "0.2.0"),
      /version differs/,
    );
    const name = Object.keys(feeds)[0];
    const original = metadata[name];
    const url = original.files[0].url;
    await writeFile(
      join(directory, name),
      JSON.stringify({
        ...original,
        files: [{ ...original.files[0], url: "../outside.exe" }],
      }),
    );
    await assert.rejects(
      validateAssets(directory, platform, version),
      /assets differ/,
    );
    await writeFile(join(directory, name), JSON.stringify(original));
    await writeFile(join(directory, url), "tampered binary");
    await assert.rejects(
      validateAssets(directory, platform, version),
      /hash differs/,
    );
    await rm(join(directory, url));
    await assert.rejects(
      validateAssets(directory, platform, version),
      /ENOENT/,
    );
  });
}
