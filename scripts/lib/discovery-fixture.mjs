import "../../apps/electron/src/identity.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";
import { stopAllVaults } from "../../apps/electron/src/vault/manage.ts";
import { validateVaultConfig } from "../../apps/electron/src/vault/validate.ts";

let finished = false;
const watchdog = setTimeout(
  () => finish(new Error("Discovery fixture timed out")),
  120_000,
);

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  stopAllVaults();
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
}

async function inventory(directory) {
  const entries = {};
  async function walk(path, prefix) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const key = `${prefix}${entry.name}`;
      const file = join(path, entry.name);
      if (entry.isDirectory()) {
        entries[key] = "directory";
        await walk(file, `${key}/`);
      } else {
        const metadata = await stat(file);
        entries[key] = {
          mode: metadata.mode,
          size: metadata.size,
          mtime: metadata.mtimeMs,
          hash: createHash("sha256")
            .update(await readFile(file))
            .digest("hex"),
        };
      }
    }
  }
  await walk(directory, "");
  return entries;
}

process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);
void app.whenReady().then(async () => {
  try {
    const fixture = JSON.parse(
      await readFile(process.env.DISKPOND_DISCOVERY_FIXTURE, "utf8"),
    );
    for (const item of fixture.cases) {
      const before = await inventory(item.parent);
      for (const password of [undefined, fixture.password, "incorrect"]) {
        const response = await validateVaultConfig({
          type: "INTERNAL_DRIVE",
          config: { path: item.path },
          password,
        });
        const code =
          item.code || (password === "incorrect" ? "INVALID_PASSWORD" : null);
        if (code) assert.equal(response.code, code, item.name);
        else {
          assert.ok(!response.error && !response.code, item.name);
          assert.equal(response.uniqueID, fixture.uniqueID, item.name);
        }
        assert.deepEqual(await inventory(item.parent), before, item.name);
      }
      console.info(`Nonmutating discovery passed: ${item.name}`);
    }
    finish();
  } catch (error) {
    finish(error);
  }
});
