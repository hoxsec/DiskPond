import "../../apps/electron/src/identity.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app } from "electron";
import { fetchVault } from "../../apps/electron/src/vault/fetch.ts";
import {
  connectVault,
  createVault,
  stopAllVaults,
  vaults,
} from "../../apps/electron/src/vault/manage.ts";
import { startVaultServer } from "../../apps/electron/src/vault/server.ts";
import { validateVaultConfig } from "../../apps/electron/src/vault/validate.ts";
import { DEFAULT_VAULT_OPTIONS } from "../../libs/constants/src/vault.ts";

let finished = false;
const watchdog = setTimeout(
  () => finish(new Error("Discovery fixture timed out")),
  225_000,
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

async function request(vault, method, path, data) {
  const result = await fetchVault(vault, {
    method,
    path: `/api/v1/${path}`,
    data,
  });
  assert.ok(
    !result.code && !result.error,
    `Request failed: ${path} (${result.code})`,
  );
  return result;
}

async function waitFor(check) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await delay(100);
  }
  throw new Error("Repository operation timed out");
}

async function hashes(directory) {
  const entries = await inventory(directory);
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) =>
      value === "directory" ? [`${key}/`, value] : [key, value.hash],
    ),
  );
}

async function restore(vault, versions, directory, label) {
  for (const [index, version] of versions.entries()) {
    const destination = join(
      directory,
      `restore-${label}-${vault.id}-${index}`,
    );
    const task = await request(vault, "POST", "restore", {
      root: version.rootID,
      fsOutput: { targetPath: destination },
      options: {
        ignoreErrors: false,
        restoreDirEntryAtDepth: 1_000_000,
        minSizeForPlaceholder: -1,
      },
    });
    const terminal = await waitFor(async () => {
      const taskInfo = await request(vault, "GET", `tasks/${task.id}`);
      return ["RUNNING", "CANCELING"].includes(taskInfo.status)
        ? null
        : taskInfo;
    });
    assert.equal(terminal.status, "SUCCESS", terminal.errorMessage);
    assert.deepEqual(await hashes(destination), version.hashes);
  }
}

async function stopVaults() {
  const exiting = Object.values(vaults).map((vault) =>
    once(vault.server.process, "exit"),
  );
  stopAllVaults();
  await Promise.all(exiting);
}

process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);
void app.whenReady().then(async () => {
  try {
    const fixture = JSON.parse(
      await readFile(process.env.DISKPOND_DISCOVERY_FIXTURE, "utf8"),
    );
    const directory = dirname(process.env.DISKPOND_DISCOVERY_FIXTURE);
    const statePath = join(directory, "connection-state.json");
    if (process.env.DISKPOND_DISCOVERY_PHASE === "restart") {
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      for (const item of saved) {
        process.env.KOPIA_CACHE_DIRECTORY = join(
          directory,
          "engine-cache",
          item.id,
        );
        vaults[item.id] = {
          id: item.id,
          status: "STARTING",
          server: await startVaultServer(item.id, false),
        };
        assert.equal(
          (await request(vaults[item.id], "GET", "repo/status")).connected,
          true,
        );
        await restore(vaults[item.id], item.versions, directory, "restart");
        await stopVaults();
      }
      console.info(
        "Native restart/reconnect and restore hashes passed for four baseline copies and two new vaults.",
      );
      return finish();
    }

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

    const saved = [];
    for (const item of fixture.cases) {
      const before = await inventory(item.parent);
      const payload = {
        id: `vlt_${item.name}`,
        name: "Connection fixture",
        provider: "INTERNAL_DRIVE",
        config: { path: item.path },
        password: fixture.password,
      };
      process.env.KOPIA_CACHE_DIRECTORY = join(
        directory,
        "engine-cache",
        payload.id,
      );
      if (item.name !== "empty") {
        const refused = await createVault({
          vault: { ...payload, options: DEFAULT_VAULT_OPTIONS },
          userPolicy: {},
          globalPolicy: {},
        });
        assert.ok(refused.code, `Creation should reject ${item.name}`);
        assert.deepEqual(await inventory(item.parent), before);
      }
      if (item.code) {
        assert.ok(
          (await connectVault(payload)).code,
          `Connect should reject ${item.name}`,
        );
        assert.deepEqual(await inventory(item.parent), before);
        continue;
      }
      assert.equal(
        (await connectVault({ ...payload, password: "wrong" })).code,
        "INVALID_PASSWORD",
      );
      assert.deepEqual(await inventory(item.parent), before);
      const result = await connectVault(payload);
      assert.ok(!result.code && !result.error, JSON.stringify(result));
      assert.equal(
        result.coreId,
        Buffer.from(fixture.uniqueID, "base64").toString("binary"),
      );
      assert.equal(
        (await connectVault({ ...payload, id: `${payload.id}_duplicate` }))
          .code,
        "DUPLICATE_VAULT",
      );
      const after = await inventory(item.parent);
      // Existing blobs are preserved byte-for-byte, including legacy copies.
      for (const [key, value] of Object.entries(before))
        assert.deepEqual(after[key], value, key);
      const added = Object.keys(after)
        .filter((key) => !(key in before))
        .sort();
      const expected = item.name.startsWith("legacy")
        ? [
            "repository/kopia.blobcfg.f",
            "repository/kopia.repository.f",
            ...(item.name.endsWith("no-shards") ? ["repository/.shards"] : []),
          ].sort()
        : [];
      assert.deepEqual(
        added,
        expected,
        `Unexpected migration writes: ${item.name}`,
      );
      if (item.name.startsWith("legacy")) {
        const legacy = await readFile(
          join(item.path, "blinkdisk.repository.f"),
          "utf8",
        );
        const current = await readFile(
          join(item.path, "kopia.repository.f"),
          "utf8",
        );
        assert.equal(
          current,
          legacy.replaceAll(
            "https://github.com/blinkdisk/core",
            "https://github.com/kopia/kopia",
          ),
        );
        assert.deepEqual(
          await readFile(join(item.path, "kopia.blobcfg.f")),
          await readFile(join(item.path, "blinkdisk.blobcfg.f")),
        );
      }
      console.info(
        `Explicit connection writes (${item.name}): ${added.join(", ") || "none"}`,
      );
      await restore(vaults[payload.id], fixture.versions, directory, "connect");
      saved.push({ id: payload.id, versions: fixture.versions });
      await stopVaults();
    }

    for (let index = 0; index < 2; index++) {
      const path = join(directory, `new-vault-${index}`);
      await mkdir(path);
      const id = `vlt_new_discovery_${index}`;
      process.env.KOPIA_CACHE_DIRECTORY = join(directory, "engine-cache", id);
      const payload = {
        id,
        name: "New vault fixture",
        provider: "INTERNAL_DRIVE",
        config: { path },
        password: ` exact whitespace 雪 ${index} `,
      };
      assert.equal((await connectVault(payload)).code, "NOT_INITIALIZED");
      assert.deepEqual(await readdir(path), []);
      const result = await createVault({
        vault: { ...payload, options: DEFAULT_VAULT_OPTIONS },
        userPolicy: {},
        globalPolicy: { scheduling: { manual: true } },
      });
      assert.ok(!result.code && !result.error, JSON.stringify(result));
      assert.equal(result.coreId, id);
      const source = join(directory, `new-source-${index}`);
      await mkdir(source);
      await writeFile(join(source, "exact.txt"), `new vault ${index}`);
      const expected = await hashes(source);
      await request(vaults[id], "POST", "sources", {
        path: source,
        policy: { scheduling: { manual: true } },
        createSnapshot: true,
      });
      const snapshot = await waitFor(
        async () =>
          (await request(vaults[id], "GET", "snapshots")).snapshots[0],
      );
      assert.ok(!snapshot.incomplete);
      const versions = [{ rootID: snapshot.rootID, hashes: expected }];
      await restore(vaults[id], versions, directory, "created");
      saved.push({ id, versions });
    }
    await writeFile(statePath, JSON.stringify(saved));
    console.info(
      "Native create/connect guards, duplicate identity/password rejection, migration inventory and recovery passed.",
    );
    finish();
  } catch (error) {
    finish(error);
  }
});
