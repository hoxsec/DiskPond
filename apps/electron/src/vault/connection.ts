import { existsSync, lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ZConfig } from "@blinkdisk/schemas/config";
import {
  type ConnectionSummary,
  type ManagedStorage,
  ZManagedStorage,
  ZProviderConnection,
} from "@blinkdisk/schemas/connection";
import {
  type PasswordStorageStatus,
  ZPasswordVault,
  ZStoredPassword,
} from "@blinkdisk/schemas/password";
import { writeAtomicJson } from "@electron/atomic-json";
import { collections } from "@electron/db";
import {
  decryptString,
  decryptVaultConfig,
  encryptString,
  isSecureStorageAvailable,
} from "@electron/encryption";
import { updateConnectionStorageStatus } from "@electron/password";
import { globalAccountDirectory, globalVaultDirectory } from "@electron/path";
import { getHostName, getUserName } from "@electron/profile";
import { store } from "@electron/store";
import { mapConfigFields, mapProviderType } from "@electron/vault/mapping";
import { z } from "zod";

const session = new Map<string, ManagedStorage>();
const unreadable = new Set<string>();
const redactions = new Map<string, Set<string>>();
let reason: PasswordStorageStatus["reason"] = null;
const cleanupFailures = new Set<string>();
const ZMetadata = z
  .object({
    managedStorage: z.boolean().optional(),
    storage: ZManagedStorage.optional(),
    username: z.string().optional(),
    hostname: z.string().optional(),
    description: z.string().optional(),
    readonly: z.boolean().optional(),
    permissiveCacheLoading: z.boolean().optional(),
    enableActions: z.boolean().optional(),
    formatBlobCacheDuration: z.number().optional(),
    throttlingLimits: z
      .object({
        readsPerSecond: z.number().optional(),
        writesPerSecond: z.number().optional(),
        listsPerSecond: z.number().optional(),
        maxUploadSpeedBytesPerSecond: z.number().optional(),
        maxDownloadSpeedBytesPerSecond: z.number().optional(),
        concurrentReads: z.number().optional(),
        concurrentWrites: z.number().optional(),
      })
      .strict()
      .optional(),
    caching: z
      .object({
        cacheDirectory: z.string().optional(),
        maxCacheSize: z.number().optional(),
        contentCacheSizeLimitBytes: z.number().optional(),
        maxMetadataCacheSize: z.number().optional(),
        metadataCacheSizeLimitBytes: z.number().optional(),
        maxListCacheDuration: z.number().optional(),
        minMetadataSweepAge: z.number().optional(),
        minContentSweepAge: z.number().optional(),
        minIndexSweepAge: z.number().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function notify() {
  updateConnectionStorageStatus({
    reason,
    cleanupFailed: cleanupFailures.size > 0,
    needsCredentials: unreadable.size > 0,
  });
}

export function rememberConnectionSecrets(
  id: string,
  storage: ManagedStorage,
  password?: string,
) {
  const values = redactions.get(id) || new Set<string>();
  function collect(value: unknown) {
    if (typeof value === "string" && value.length > 0) {
      values.add(value);
      values.add(Buffer.from(value).toString("base64"));
      values.add(JSON.stringify(value).slice(1, -1));
      values.add(encodeURIComponent(value));
      // Providers may report only a token, a JSON key, or URL user-info.
      try {
        const url = new URL(value);
        for (const part of [
          url.username,
          url.password,
          ...url.searchParams.values(),
        ])
          if (part) {
            values.add(part);
            values.add(decodeURIComponent(part));
          }
      } catch {
        /* Not a URL. */
      }
      if (value.startsWith("{")) {
        try {
          collect(JSON.parse(value));
        } catch {
          /* Not JSON. */
        }
      }
    } else if (value && typeof value === "object")
      for (const entry of Object.values(value)) collect(entry);
  }
  collect(storage.config);
  if (password) collect(password);
  redactions.set(id, values);
}

export function redactConnectionError(id: string, text: string) {
  const values = [...(redactions.get(id) || [])].sort(
    (a, b) => b.length - a.length,
  );
  if (!values.length) return text;
  const pattern = values
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return text.replace(new RegExp(pattern, "g"), "[redacted]");
}

export function connectionFromProvider(
  provider: string,
  config: unknown,
): ManagedStorage {
  const parsed = ZProviderConnection.safeParse({ provider, config });
  if (!parsed.success) throw new Error("Invalid provider configuration");
  return ZManagedStorage.parse({
    type: mapProviderType(provider),
    config: mapConfigFields(provider, parsed.data.config),
  });
}

export function saveConnection(id: string, storage: ManagedStorage) {
  ZPasswordVault.parse({ vaultId: id });
  const json = JSON.stringify(storage);
  if (json.length > 1_048_576 || !ZManagedStorage.safeParse(storage).success)
    throw new Error("Invalid provider configuration");
  session.set(id, structuredClone(storage));
  rememberConnectionSecrets(id, storage);
  unreadable.delete(id);
  const encrypted = reason ? null : encryptString(json);
  try {
    if (!encrypted) {
      reason ||= isSecureStorageAvailable()
        ? "PROTECTION_FAILED"
        : "UNAVAILABLE";
      store.delete(`connections.${id}`);
    } else {
      store.set(`connections.${id}`, encrypted);
      const written = ZStoredPassword.parse(store.get(`connections.${id}`));
      if (decryptString(written) !== json)
        throw new Error("Connection readback failed");
    }
    cleanupFailures.delete(`store:${id}`);
  } catch {
    reason = "SAVE_FAILED";
    try {
      store.delete(`connections.${id}`);
    } catch {
      cleanupFailures.add(`store:${id}`);
    }
  }
  notify();
}

export function getConnection(id: string): ManagedStorage | null {
  ZPasswordVault.parse({ vaultId: id });
  const cached = session.get(id);
  if (cached) return structuredClone(cached);
  try {
    const raw: unknown = store.get(`connections.${id}`);
    if (raw === undefined || raw === null) return null;
    const encrypted = ZStoredPassword.parse(raw);
    const json = decryptString(encrypted);
    if (!json || json.length > 1_048_576)
      throw new Error("Unavailable connection");
    const result = ZManagedStorage.parse(JSON.parse(json));
    session.set(id, result);
    rememberConnectionSecrets(id, result);
    unreadable.delete(id);
    return structuredClone(result);
  } catch {
    unreadable.add(id);
    notify();
    return null;
  }
}

// Atomic replacement contains only metadata, never a temporary plaintext copy.
function migrateCoreFile(id: string) {
  const filename = resolve(globalVaultDirectory(), `${id}.config`);
  let opened = false;
  try {
    const info = lstatSync(filename);
    opened = true;
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1_048_576)
      throw new Error("Invalid connection file");
    const parsed = ZMetadata.safeParse(
      JSON.parse(readFileSync(filename, "utf8")),
    );
    if (!parsed.success) throw new Error("Unsupported connection file");
    if (parsed.data.managedStorage && !parsed.data.storage) {
      cleanupFailures.delete(`core:${id}`);
      return;
    }
    if (!parsed.data.storage) throw new Error("Missing provider connection");
    if (
      JSON.stringify(getConnection(id)) !== JSON.stringify(parsed.data.storage)
    )
      saveConnection(id, parsed.data.storage);
    const { storage: _storage, ...metadata } = parsed.data;
    writeAtomicJson(filename, { ...metadata, managedStorage: true });
    cleanupFailures.delete(`core:${id}`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT" &&
      !opened
    )
      return;
    cleanupFailures.add(`core:${id}`);
    notify();
    throw new Error("Saved provider connection needs migration or cleanup");
  }
}

function legacyConfigs(id: string) {
  const vault = collections.local?.vault.findOne({ id, status: "ACTIVE" });
  const collection = collections.local?.config;
  if (!vault || !collection) return [];
  const userName = getUserName(id);
  const hostName = getHostName(id);
  const records = ZConfig.array().safeParse(
    collection.find({ vaultId: id }).fetch(),
  );
  if (!records.success) throw new Error("Invalid saved provider records");
  return records.data
    .filter(
      (entry) =>
        entry.level === vault.configLevel &&
        (entry.level === "VAULT" ||
          (entry.userName === userName && entry.hostName === hostName)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function prepareConnection(id: string, password?: string | null) {
  ZPasswordVault.parse({ vaultId: id });
  migrateCoreFile(id);
  let connection = getConnection(id);
  const vault = collections.local?.vault.findOne({ id });
  const collection = collections.local?.config;
  if (connection || !vault || !collection) return connection;
  try {
    const candidates = legacyConfigs(id);
    const latest = candidates[0];
    if (latest && password) {
      const config = await decryptVaultConfig({
        password,
        encrypted: latest.data,
      });
      connection = connectionFromProvider(vault.provider, config);
      saveConnection(id, connection);
    }
    if (!connection && candidates.length) {
      unreadable.add(id);
      notify();
    }
  } catch {
    unreadable.add(id);
    notify();
    return null;
  }
  return connection;
}

// Only discard the selected inherited envelopes after a confirmed connection.
// SignalDB removal is asynchronous; wait for the atomic filesystem save.
export async function completeConnectionMigration(id: string) {
  const collection = collections.local?.config;
  if (!collection) return;
  try {
    const candidates = legacyConfigs(id);
    if (!candidates.length) return;
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        collection.off("persistence.pushCompleted", success);
        collection.off("persistence.error", failure);
        if (error) reject(error);
        else resolve();
      };
      const success = () => finish();
      const failure = () => finish(new Error("Credential cleanup failed"));
      const timeout = setTimeout(failure, 5_000);
      collection.on("persistence.pushCompleted", success);
      collection.on("persistence.error", failure);
      try {
        collection.removeMany({
          id: { $in: candidates.map((entry) => entry.id) },
        });
      } catch {
        failure();
      }
    });
    const persisted = ZConfig.array().parse(
      JSON.parse(
        readFileSync(
          resolve(globalAccountDirectory(), "local", "config.json"),
          "utf8",
        ),
      ),
    );
    if (
      persisted.some((entry) =>
        candidates.some((candidate) => candidate.id === entry.id),
      )
    )
      throw new Error("Credential cleanup was not persisted");
    cleanupFailures.delete(`envelope:${id}`);
    unreadable.delete(id);
  } catch {
    cleanupFailures.add(`envelope:${id}`);
    // Restore the persisted records in memory so a later unlock can retry.
    try {
      await collection.resetData();
    } catch {
      /* Retry from disk on restart. */
    }
  }
  notify();
}

export function hasSavedConnection(id: string) {
  return (
    session.has(id) ||
    store.has(`connections.${id}`) ||
    existsSync(resolve(globalVaultDirectory(), `${id}.config`))
  );
}

export async function getConnectionSummary({
  vaultId,
}: {
  vaultId: string;
}): Promise<ConnectionSummary> {
  const connection = getConnection(vaultId);
  if (!connection) return null;
  const fields: NonNullable<ConnectionSummary>["fields"] = [];
  const keys: Record<
    string,
    NonNullable<ConnectionSummary>["fields"][number]["key"]
  > = {
    path: "path",
    host: "host",
    port: "port",
    bucket: "bucket",
    region: "region",
    prefix: "prefix",
    container: "container",
    remotePath: "remotePath",
    rcloneExe: "rclonePath",
    doNotUseTLS: "disableTls",
    doNotVerifyTLS: "disableTlsVerification",
  };
  for (const [source, key] of Object.entries(keys)) {
    const value = connection.config[source];
    if (
      (typeof value === "string" && value) ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      fields.push({ key, value });
  }
  const endpoint = connection.config.url || connection.config.endpoint;
  if (typeof endpoint === "string") {
    try {
      const url = new URL(
        endpoint.includes("://") ? endpoint : `https://${endpoint}`,
      );
      if (["http:", "https:"].includes(url.protocol))
        fields.push({ key: "endpoint", value: url.origin });
    } catch {
      /* Do not display a possibly credential-bearing malformed URL. */
    }
  }
  return { fields };
}
