import "../../apps/electron/src/identity.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app, safeStorage } from "electron";
import {
  collections,
  setupCollections,
} from "../../apps/electron/src/db/index.ts";
import { encryptVaultConfig } from "../../apps/electron/src/encryption.ts";
import { getPasswordStorageStatus } from "../../apps/electron/src/password.ts";
import {
  globalConfigDirectory,
  globalVaultDirectory,
} from "../../apps/electron/src/path.ts";
import { store } from "../../apps/electron/src/store.ts";
import {
  getConnection,
  getConnectionSummary,
} from "../../apps/electron/src/vault/connection.ts";
import { fetchVault } from "../../apps/electron/src/vault/fetch.ts";
import {
  createVault,
  stopAllVaults,
  unlockVault,
  vaults,
} from "../../apps/electron/src/vault/manage.ts";
import { startVaultServer } from "../../apps/electron/src/vault/server.ts";
import { DEFAULT_VAULT_OPTIONS } from "../../libs/constants/src/vault.ts";
import { scanCredentials } from "./credential-scan.mjs";

const directory = globalConfigDirectory();
const phase = process.env.DISKPOND_PROVIDER_PHASE;
const mode = process.env.DISKPOND_PROVIDER_MODE;
const secrets = ["DiskPond-provider-fixture-0", "DiskPond-provider-fixture-1"];
const passwords = [
  " DiskPond-vault-fixture-雪-0 ",
  "DiskPond-vault-fixture-雪-1",
];
const statePath = join(directory, "fixture-state.json");
let finished = false;
const watchdog = setTimeout(
  () => finish(new Error("Provider fixture timed out")),
  180_000,
);

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  stopAllVaults();
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
}
process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);

const scan = (path) => scanCredentials(path, [...secrets, ...passwords], true);
async function hashes(path, prefix = "") {
  const result = {};
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const key = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      result[`${key}/`] = "directory";
      Object.assign(result, await hashes(join(path, entry.name), `${key}/`));
    } else
      result[key] = createHash("sha256")
        .update(await readFile(join(path, entry.name)))
        .digest("hex");
  }
  return result;
}
async function request(vault, method, path, data) {
  const result = await fetchVault(vault, {
    method,
    path: `/api/v1/${path}`,
    data,
  });
  assert.ok(
    !result.code && !result.error,
    `Engine request failed: ${path} (${result.code})`,
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
  throw new Error("Provider fixture operation did not finish");
}
async function restartEngine(id) {
  const exited = once(vaults[id].server.process, "exit");
  vaults[id].server.process.kill();
  await exited;
  delete vaults[id];
  vaults[id] = {
    id,
    status: "STARTING",
    server: await startVaultServer(id, false),
  };
  assert.equal(
    (await request(vaults[id], "GET", "repo/status")).connected,
    true,
  );
}
async function restoreVersions(vault, versions, label) {
  for (const [index, version] of versions.entries()) {
    const destination = join(
      directory,
      "restores",
      `${vault.id}-${label}-${index}`,
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
      const current = await request(vault, "GET", `tasks/${task.id}`);
      return ["RUNNING", "CANCELING"].includes(current.status) ? null : current;
    });
    assert.equal(terminal.status, "SUCCESS", terminal.errorMessage);
    assert.deepEqual(await hashes(destination), version.hashes);
  }
}

async function seedLegacy() {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const configs = [];
  for (const [index, item] of state.entries()) {
    const id = item.id;
    const storage = getConnection(id);
    assert.ok(storage);
    const file = join(globalVaultDirectory(), `${id}.config`);
    const metadata = JSON.parse(await readFile(file, "utf8"));
    metadata.username = `legacy-user-${index}`;
    metadata.hostname = `legacy-host-${index}`;
    metadata.throttlingLimits = {
      maxUploadSpeedBytesPerSecond: 8_000_000,
      maxDownloadSpeedBytesPerSecond: 9_000_000,
    };
    // Vault 0 migrates plaintext core JSON, vault 1 only the inherited envelope.
    if (index === 0) {
      delete metadata.managedStorage;
      metadata.storage = storage;
    }
    await writeFile(file, JSON.stringify(metadata));
    store.delete(`connections.${id}`);
    const config = {
      url: storage.config.url,
      user: storage.config.username,
      password: storage.config.password,
    };
    configs.push({
      id: `cfg_fixture_${index}`,
      vaultId: id,
      level: "VAULT",
      createdAt: new Date().toISOString(),
      data: await encryptVaultConfig({ password: passwords[index], config }),
    });
  }
  configs.push({
    ...configs[0],
    id: "cfg_other_profile",
    level: "PROFILE",
    userName: "other-user",
    hostName: "other-host",
  });
  await writeFile(
    join(directory, "accounts/local/config.json"),
    JSON.stringify(configs),
  );
}

void app.whenReady().then(async () => {
  try {
    console.info(`Provider fixture starting: ${mode}/${phase}`);
    if (phase === "seed-legacy") {
      await seedLegacy();
      return finish();
    }
    if (["session", "locked"].includes(mode))
      safeStorage.isEncryptionAvailable = () => false;
    if (mode === "failure")
      safeStorage.encryptString = () => {
        throw new Error("Injected protection failure");
      };
    if (mode === "write-failure") {
      const set = store.set.bind(store);
      store.set = (key, value) => {
        if (typeof key === "string" && key.startsWith("connections."))
          throw new Error("Injected connection save failure");
        return set(key, value);
      };
    }
    if (mode === "protected")
      assert.equal(safeStorage.isEncryptionAvailable(), true);
    await setupCollections();
    const state =
      phase === "create" ? [] : JSON.parse(await readFile(statePath, "utf8"));
    for (let index = 0; index < 2; index++) {
      const id = `vlt_provider_fixture_${index}`;
      const config = {
        url: `${process.env.DISKPOND_WEBDAV_URL}/${process.env.DISKPOND_PROVIDER_NAMESPACE}/repo-${index}`,
        user: `fixture-provider-${index}`,
        password: secrets[index],
      };
      if (phase === "create") {
        await mkdir(globalVaultDirectory(), { recursive: true });
        await writeFile(
          join(globalVaultDirectory(), `${id}.config`),
          JSON.stringify({
            managedStorage: true,
            username: `fixture-user-${index}`,
            hostname: `fixture-host-${index}`,
            caching: {
              cacheDirectory: join(directory, "engine-cache", id),
              maxCacheSize: 10_000_000,
              maxMetadataCacheSize: 10_000_000,
            },
          }),
        );
        const result = await createVault({
          vault: {
            id,
            name: `Provider fixture ${index}`,
            provider: "WEBDAV",
            config,
            password: passwords[index],
            options: DEFAULT_VAULT_OPTIONS,
          },
          userPolicy: {},
          globalPolicy: { scheduling: { manual: true } },
        });
        assert.ok(
          !result.error && !result.code,
          "Credentialed repository creation failed",
        );
        const persisted = new Promise((resolve, reject) => {
          collections.local.vault.once("persistence.transmitted", resolve);
          collections.local.vault.once("persistence.error", reject);
        });
        collections.local.vault.insert({
          id,
          name: `Provider fixture ${index}`,
          provider: "WEBDAV",
          coreId: id,
          configLevel: "VAULT",
          status: "ACTIVE",
          options: DEFAULT_VAULT_OPTIONS,
          version: 2,
          createdAt: new Date().toISOString(),
        });
        await persisted;
        const source = join(directory, `source-${index}`);
        await mkdir(join(source, "nested", "空"), { recursive: true });
        await writeFile(join(source, "version.txt"), "version A");
        await writeFile(join(source, "deleted.txt"), "only in A");
        await writeFile(
          join(source, "nested", "雪.bin"),
          Buffer.alloc(256 * 1024, index + 41),
        );
        const versions = [];
        for (let version = 0; version < 2; version++) {
          if (version) {
            await writeFile(join(source, "version.txt"), "version B changed");
            await rm(join(source, "deleted.txt"));
            await writeFile(join(source, "added.txt"), "only in B");
          }
          const expected = await hashes(source);
          if (!version)
            await request(vaults[id], "POST", "sources", {
              path: source,
              policy: { scheduling: { manual: true } },
              createSnapshot: true,
            });
          else await request(vaults[id], "POST", "sources/upload");
          const snapshot = await waitFor(async () => {
            const list = await request(vaults[id], "GET", "snapshots");
            return list.snapshots.find(
              (entry) => !versions.some((old) => old.id === entry.id),
            );
          });
          assert.ok(!snapshot.incomplete, "Snapshot must be complete");
          versions.push({
            id: snapshot.id,
            rootID: snapshot.rootID,
            hashes: expected,
          });
          await scan(process.env.DISKPOND_PROVIDER_ROOT);
        }
        state.push({ id, versions });
        await restartEngine(id);
        await restoreVersions(vaults[id], versions, "engine-restart");
      } else {
        const status = await request(vaults[id], "GET", "repo/status");
        if (mode === "protected") assert.equal(status.connected, true);
        else {
          assert.equal(status.connected, false);
          assert.ok(!status.initTaskID);
          const saved = getConnection(id);
          const other = 1 - index;
          for (const invalid of [
            { ...config, password: secrets[other] },
            {
              ...config,
              user: `fixture-provider-${other}`,
              password: secrets[other],
            },
          ]) {
            const rejected = await unlockVault({
              vaultId: id,
              password: passwords[index],
              config: invalid,
            });
            assert.ok(
              rejected.code,
              "Wrong provider credentials were accepted",
            );
            assert.equal(
              (await request(vaults[id], "GET", "repo/status")).connected,
              false,
            );
            assert.deepEqual(getConnection(id), saved);
          }
          assert.equal(
            (
              await unlockVault({
                vaultId: id,
                password: "wrong-fixture-password",
                config,
              })
            ).code,
            "INVALID_PASSWORD",
          );
          assert.deepEqual(
            await unlockVault({
              vaultId: id,
              password: passwords[index],
              config,
            }),
            {},
          );
        }
        if (["migrate", "migrated-restart"].includes(phase)) {
          const metadata = JSON.parse(
            await readFile(
              join(globalVaultDirectory(), `${id}.config`),
              "utf8",
            ),
          );
          assert.equal(metadata.username, `legacy-user-${index}`);
          assert.equal(metadata.hostname, `legacy-host-${index}`);
          assert.equal(
            metadata.throttlingLimits.maxUploadSpeedBytesPerSecond,
            8_000_000,
          );
          assert.equal(
            metadata.throttlingLimits.maxDownloadSpeedBytesPerSecond,
            9_000_000,
          );
          assert.equal(metadata.managedStorage, true);
          assert.ok(!metadata.storage);
        }
        await restoreVersions(
          vaults[id],
          state[index].versions,
          `${mode}-${phase}`,
        );
      }
      assert.ok(
        !JSON.stringify(await getConnectionSummary({ vaultId: id })).includes(
          secrets[index],
        ),
      );
      const metadata = JSON.parse(
        await readFile(join(globalVaultDirectory(), `${id}.config`), "utf8"),
      );
      assert.equal(metadata.managedStorage, true);
      assert.ok(!metadata.storage);
      assert.equal(
        resolve(globalVaultDirectory(), metadata.caching.cacheDirectory),
        join(directory, "engine-cache", id),
      );
      await scan(process.env.DISKPOND_PROVIDER_ROOT);
    }
    if (phase === "migrate") {
      const remaining = JSON.parse(
        await readFile(join(directory, "accounts/local/config.json"), "utf8"),
      );
      assert.deepEqual(
        remaining.map((entry) => entry.id),
        ["cfg_other_profile"],
      );
    }
    await writeFile(statePath, JSON.stringify(state));
    assert.equal(
      getPasswordStorageStatus().mode,
      mode === "protected" ? "PROTECTED" : "SESSION",
    );
    assert.equal(getPasswordStorageStatus().cleanupFailed, false);
    console.info(`Provider fixture passed: ${mode}/${phase}`);
    finish();
  } catch (error) {
    finish(error);
  }
});
