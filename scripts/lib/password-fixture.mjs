import "../../apps/electron/src/identity.ts";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app, safeStorage } from "electron";
import {
  getPasswordCache,
  getPasswordStorageStatus,
  setPasswordCache,
} from "../../apps/electron/src/password.ts";
import { globalConfigDirectory } from "../../apps/electron/src/path.ts";
import { fetchVault } from "../../apps/electron/src/vault/fetch.ts";
import {
  connectVault,
  createVault,
  stopAllVaults,
  vaults,
} from "../../apps/electron/src/vault/manage.ts";
import { startVaultServer } from "../../apps/electron/src/vault/server.ts";
import { DEFAULT_VAULT_OPTIONS } from "../../libs/constants/src/vault.ts";

const mode = process.env.DISKPOND_PASSWORD_TEST_MODE;
const phase = process.env.DISKPOND_PASSWORD_TEST_PHASE;
const secrets = [
  "DiskPond-fixture-only-雪-01",
  "DiskPond-fixture-only-雪-02",
  " DiskPond-fixture-only-雪-03 ",
];
const extraServers = new Set();
const watchdog = setTimeout(
  () => finish(new Error("Password fixture timed out")),
  75_000,
);
let finished = false;

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  stopAllVaults();
  for (const server of extraServers) server.process.kill();
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
}

process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);

async function waitConnected(vault) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const status = await fetchVault(vault, {
      method: "GET",
      path: "/api/v1/repo/status",
    });
    if (status.connected) return;
    await delay(100);
  }
  throw new Error("Fixture vault did not connect");
}

async function killEngine(vault) {
  const exited = once(vault.server.process, "exit");
  vault.server.process.kill();
  await exited;
  delete vaults[vault.id];
}

void app.whenReady().then(async () => {
  try {
    console.info(`Password fixture starting: ${mode}/${phase}`);
    if (["session", "locked"].includes(mode))
      safeStorage.isEncryptionAvailable = () => false;
    if (mode === "failure")
      safeStorage.encryptString = () => {
        throw new Error("Injected key-store failure");
      };
    if (mode === "protected")
      assert.equal(
        safeStorage.isEncryptionAvailable(),
        true,
        "Native secure storage is required for this scenario",
      );
    for (const [index, password] of secrets.entries()) {
      const id = `vlt_password_fixture_${index}`;
      // Core's explicit cache override is a cache directory, not a parent.
      // Give each repository its own cache to preserve engine isolation.
      process.env.KOPIA_CACHE_DIRECTORY = join(
        globalConfigDirectory(),
        "engine-cache",
        id,
      );
      const config = {
        path: join(globalConfigDirectory(), `repository-${index}`),
      };
      const descriptor = {
        id,
        name: `Fixture ${index}`,
        provider: "INTERNAL_DRIVE",
        config,
        password,
      };
      if (phase === "create") {
        await mkdir(config.path, { recursive: true });
        const created = await createVault({
          vault: { ...descriptor, options: DEFAULT_VAULT_OPTIONS },
          userPolicy: {},
          globalPolicy: {},
        });
        assert.ok(
          !created.error,
          `Repository creation failed: ${String(created.error).replaceAll(password, "[redacted]")}`,
        );
        await waitConnected(vaults[id]);
        const status = setPasswordCache({ vaultId: id, password });
        assert.equal(
          status.mode,
          mode === "protected" ? "PROTECTED" : "SESSION",
        );
        // Kill the actual sidecar, then reconnect within the same desktop session.
        await killEngine(vaults[id]);
        const server = await startVaultServer(id, false);
        extraServers.add(server);
        const vault = { id, status: "STARTING", server };
        await waitConnected(vault);
        await killEngine(vault);
        extraServers.delete(server);
      } else {
        const cached = getPasswordCache({ vaultId: id });
        assert.equal(cached, mode === "protected" ? password : null);
        const server = await startVaultServer(id, false);
        extraServers.add(server);
        const vault = { id, status: "STARTING", server };
        if (mode === "protected") await waitConnected(vault);
        else {
          const status = await fetchVault(vault, {
            method: "GET",
            path: "/api/v1/repo/status",
          });
          assert.equal(status.connected, false);
          assert.ok(
            !status.initTaskID,
            "Missing password must not leave an infinite startup task",
          );
          vaults[id] = vault;
          const wrongPassword = await connectVault({
            ...descriptor,
            password: "incorrect-fixture-password",
          });
          assert.equal(
            wrongPassword.code,
            "INVALID_PASSWORD",
            "Wrong passwords must not connect",
          );
          const result = await connectVault(descriptor);
          assert.ok(!result.error && !result.code, "Password re-entry failed");
          await waitConnected(vault);
          setPasswordCache({ vaultId: id, password });
        }
        await killEngine(vault);
        extraServers.delete(server);
      }
    }
    const settings = await readFile(
      join(globalConfigDirectory(), "config.json"),
      "utf8",
    );
    assert.ok(!settings.includes('"PLAIN"'));
    if (mode === "locked")
      assert.equal(getPasswordStorageStatus().mode, "SESSION");
    console.info(`Password fixture passed: ${mode}/${phase}`);
    finish();
  } catch (error) {
    finish(error);
  }
});
