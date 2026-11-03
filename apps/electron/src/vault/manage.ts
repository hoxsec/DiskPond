import { LOCAL_ACCOUNT_ID } from "@blinkdisk/constants/account";
import type { StorageProviderType } from "@blinkdisk/constants/providers";
import { ZUnlockVaultRequest } from "@blinkdisk/schemas/connection";
import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import type { ZVaultOptionsType } from "@blinkdisk/schemas/vault";
import { collections } from "@electron/db";
import { log } from "@electron/log";
import { preparePasswordCache, setPasswordCache } from "@electron/password";
import { getHostName, getUserName } from "@electron/profile";
import {
  completeConnectionMigration,
  connectionFromProvider,
  prepareConnection,
  redactConnectionError,
  rememberConnectionSecrets,
  saveConnection,
} from "@electron/vault/connection";
import { fetchVault } from "@electron/vault/fetch";
import { connectRepository } from "@electron/vault/reconnect";
import { startVaultServer } from "@electron/vault/server";
import type { VaultInstance } from "@electron/vault/types";
import { validationVault } from "@electron/vault/validate";
import { z } from "zod";

export const vaults: Record<string, VaultInstance> = {};
const vaultStartupStates = new Map<string, "STARTING" | "FAILED">();

function asError(error: unknown): Error & { code?: string } {
  if (error instanceof Error) return error;

  if (error && typeof error === "object") {
    const fields = error as { code?: string; error?: string; message?: string };
    return Object.assign(
      new Error(
        fields.message || fields.error || fields.code || "Vault failed",
      ),
      fields,
    );
  }

  return new Error("Vault failed");
}

export async function createVault(payload: {
  vault: {
    id: string;
    name: string;
    provider: StorageProviderType;
    config: ProviderConfig;
    options: ZVaultOptionsType;
    password: string;
  };
  userPolicy: object;
  globalPolicy: object;
}) {
  const options = payload.vault.options;
  const storage = connectionFromProvider(
    payload.vault.provider,
    payload.vault.config,
  );
  rememberConnectionSecrets(payload.vault.id, storage, payload.vault.password);

  let vault: VaultInstance;
  const existingVault = vaults[payload.vault.id];
  if (existingVault) vault = existingVault;
  else
    vault = {
      id: payload.vault.id,
      status: "STARTING",
      server: await startVaultServer(payload.vault.id),
    };

  try {
    const result = await connectRepository(
      vault,
      {
        globalPolicy: payload.globalPolicy,
        userPolicy: payload.userPolicy,
        clientOptions: {
          description: payload.vault.name,
          username: getUserName(payload.vault.id),
          hostname: getHostName(payload.vault.id),
        },
        options: {
          uniqueId: btoa(payload.vault.id),
          blockFormat: {
            version: options.version,
            ecc: options.errorCorrectionAlgorithm,
            eccOverheadPercent: options.errorCorrectionOverhead,
            encryption: options.encryption,
            hash: options.hash,
          },
          objectFormat: {
            splitter: options.splitter,
          },
        },
        storage,
        password: payload.vault.password,
      },
      true,
    );
    if (result.error || result.code) {
      vault.server.process.kill();
      return result;
    }
    vaults[vault.id] = vault;
    saveConnection(vault.id, storage);
    setPasswordCache({ vaultId: vault.id, password: payload.vault.password });
    return result;
  } catch (e) {
    log.error("Failed to create vault, stopping");
    if (vaults[vault.id]) stopVault(vault.id);
    else vault.server.process.kill();
    throw new Error(redactConnectionError(vault.id, asError(e).message));
  }
}

export async function connectVault({
  id,
  name,
  config,
  password,
  provider,
}: {
  id: string;
  name: string;
  provider: StorageProviderType;
  config: ProviderConfig;
  password: string;
  version?: number;
}) {
  let startedVault: VaultInstance | undefined;
  try {
    const storage = connectionFromProvider(provider, config);
    rememberConnectionSecrets(id, storage, password);
    let vault: VaultInstance;
    const existingVault = vaults[id];
    if (existingVault) vault = existingVault;
    else {
      startedVault = vault = {
        id,
        status: "STARTING",
        server: await startVaultServer(id),
      };
    }

    const result = await connectRepository(vault, {
      clientOptions: {
        description: name,
        username: getUserName(id),
        hostname: getHostName(id),
      },
      storage,
      password,
    });
    if (!result.error && !result.code) {
      saveConnection(id, storage);
      setPasswordCache({ vaultId: id, password });
      await completeConnectionMigration(id);
      vaults[id] = vault;
      vaultStartupStates.delete(id);
    } else startedVault?.server.process.kill();
    return {
      ...result,
      ...(result.error
        ? { error: redactConnectionError(id, result.error) }
        : {}),
    };
  } catch (e) {
    startedVault?.server.process.kill();
    const error = asError(e);
    return {
      error: redactConnectionError(id, error.message),
      code: error.code,
    };
  }
}

export async function unlockVault(input: z.infer<typeof ZUnlockVaultRequest>) {
  const { vaultId, password, config } = ZUnlockVaultRequest.parse(input);
  const descriptor = collections.local?.vault.findOne({
    id: vaultId,
    status: "ACTIVE",
  });
  if (!descriptor) throw new Error("Local vault not found");
  const storage = config
    ? connectionFromProvider(descriptor.provider, config)
    : await prepareConnection(vaultId, password);
  if (!storage) return { code: "CONNECTION_REQUIRED" };
  rememberConnectionSecrets(vaultId, storage, password);
  const server = vaults[vaultId]?.server || (await startVaultServer(vaultId));
  const vault = vaults[vaultId] || {
    id: vaultId,
    status: "STARTING" as const,
    server,
  };
  vaults[vaultId] = vault;
  const checked = z
    .object({ uniqueID: z.string().optional(), code: z.string().optional() })
    .passthrough()
    .parse(
      await fetchVault(vault, {
        method: "POST",
        path: "/api/v1/repo/exists",
        data: { storage, password },
      }),
    );
  if (checked.code) return { code: checked.code };
  if (
    Buffer.from(checked.uniqueID || "", "base64").toString("binary") !==
    descriptor.coreId
  )
    return { code: "INCORRECT_VAULT" };
  const result = await connectRepository(vault, {
    storage,
    password,
    clientOptions: {
      description: descriptor.name,
      username: getUserName(vaultId),
      hostname: getHostName(vaultId),
    },
  });
  if (result.code || result.error)
    return { code: result.code || "CONNECTION_FAILED" };
  saveConnection(vaultId, storage);
  setPasswordCache({ vaultId, password });
  await completeConnectionMigration(vaultId);
  return {};
}

let initPromise: Promise<void> = Promise.resolve();

export function initVaults(vaultId?: string) {
  initPromise = initPromise
    .then(() => reconcileVaults(vaultId))
    .catch((error) => log.error("Failed to initialize vaults", error));
  return initPromise;
}

export function retryVault(id: string) {
  if (vaultStartupStates.get(id) !== "FAILED") return Promise.resolve();
  return initVaults(id);
}

export function vaultServerStopped(
  id: string,
  process: VaultInstance["server"]["process"],
) {
  if (vaults[id]?.server.process !== process) return;
  delete vaults[id];
  vaultStartupStates.set(id, "FAILED");
}

async function reconcileVaults(vaultId?: string) {
  const activeVaultIds: string[] = [];

  for (const [accountId, collection] of Object.entries(collections)) {
    if (accountId !== LOCAL_ACCOUNT_ID) continue;

    const vaultCache = collection.vault.find({ status: "ACTIVE" }).fetch();

    for (const vault of vaultCache) {
      activeVaultIds.push(vault.id);
      if (vaultId && vault.id !== vaultId) continue;

      // Already running
      if (vaults[vault.id]) {
        vaultStartupStates.delete(vault.id);
        continue;
      }

      vaultStartupStates.set(vault.id, "STARTING");
      try {
        preparePasswordCache(vault.id);
        vaults[vault.id] = {
          id: vault.id,
          status: "STARTING",
          server: await startVaultServer(vault.id),
        };
        vaultStartupStates.delete(vault.id);
      } catch (error) {
        vaultStartupStates.set(vault.id, "FAILED");
        log.error(`Failed to start vault ${vault.id}`, error);
      }
    }
  }

  for (const vaultId of Object.keys(vaults)) {
    if (activeVaultIds.includes(vaultId)) continue;
    stopVault(vaultId);
  }

  for (const vaultId of vaultStartupStates.keys()) {
    if (!activeVaultIds.includes(vaultId)) vaultStartupStates.delete(vaultId);
  }
}

export function stopAllVaults() {
  Object.keys(vaults).forEach(stopVault);
  vaultStartupStates.clear();
  if (validationVault) validationVault.server.process.kill();
}

function stopVault(id: string) {
  const vault = vaults[id];
  if (!vault) return log.warn(`Tried to stop vault ${id} but it doesn't exist`);

  vault.server.process.kill();
  delete vaults[id];
}

export function getVault(id: string) {
  const vault = vaults[id];
  if (!vault) throw new Error(`Get vault called, but ${id} not found`);
  return vault;
}

export function getVaultStatus(id: string) {
  const startupStatus = vaultStartupStates.get(id);
  if (!vaults[id] && startupStatus)
    return { status: startupStatus, initTask: undefined };

  try {
    const vault = getVault(id);
    return { status: vault.status, initTask: vault.initTask };
  } catch (e) {
    console.error(e);
    return null;
  }
}
