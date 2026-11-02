import { EventEmitter } from "node:events";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  saved: new Map<string, unknown>(),
  crypt: new Map<string, string>(),
  available: true,
  failEncrypt: false,
  failSave: false,
  failRename: false,
  status: vi.fn(),
}));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    renameSync: (...args: Parameters<typeof fs.renameSync>) => {
      if (mocks.failRename)
        throw new Error("Injected replacement interruption");
      return fs.renameSync(...args);
    },
  };
});
vi.mock("@electron/path", () => ({
  globalVaultDirectory: () => directory,
  globalAccountDirectory: () => directory,
}));
vi.mock("@electron/password", () => ({
  updateConnectionStorageStatus: mocks.status,
}));
vi.mock("@electron/profile", () => ({
  getUserName: () => "profile-user",
  getHostName: () => "profile-host",
}));
vi.mock("@electron/log", () => ({ log: { warn: vi.fn() } }));
vi.mock("@electron/store", () => ({
  store: {
    get: (key: string) => mocks.saved.get(key),
    has: (key: string) => mocks.saved.has(key),
    delete: (key: string) => mocks.saved.delete(key),
    set: (key: string, value: unknown) => {
      if (mocks.failSave) throw new Error("Injected write failure");
      mocks.saved.set(key, value);
    },
  },
}));
vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => mocks.available,
    encryptString: (plain: string) => {
      if (mocks.failEncrypt) throw new Error("Injected protection failure");
      const cipher = crypto.randomUUID();
      mocks.crypt.set(cipher, plain);
      return Buffer.from(cipher);
    },
    decryptString: (cipher: Buffer) => {
      const plain = mocks.crypt.get(cipher.toString());
      if (!plain) throw new Error("Locked ciphertext");
      return plain;
    },
  },
}));
vi.mock("@electron/db", () => ({
  collections: {
    local: {
      vault: {
        findOne: () => ({
          id: "vlt_local",
          status: "ACTIVE",
          provider: "WEBDAV",
          configLevel: "VAULT",
        }),
      },
      get config() {
        return collection;
      },
    },
  },
}));

let directory: string;
let records: unknown[];
let collection: EventEmitter & {
  find: () => { fetch: () => typeof records };
  removeMany: ReturnType<typeof vi.fn>;
  resetData: ReturnType<typeof vi.fn>;
};
const storage = {
  type: "webdav" as const,
  config: {
    url: "https://name:URL-password@example.test/secret-path?token=URL-token",
    username: "provider-user",
    password: "provider-password",
    optional: "",
    flag: false,
  },
};
const metadata = {
  username: "original-user",
  hostname: "original-host",
  description: "Original vault",
  enableActions: false,
  formatBlobCacheDuration: -1,
  caching: { cacheDirectory: "../cache", maxCacheSize: 0 },
  throttlingLimits: {
    maxUploadSpeedBytesPerSecond: 1234,
    maxDownloadSpeedBytesPerSecond: 0,
  },
};
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.saved.clear();
  mocks.crypt.clear();
  mocks.available = true;
  mocks.failEncrypt = false;
  mocks.failSave = false;
  mocks.failRename = false;
  directory = mkdtempSync(
    join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-connection-"),
  );
  records = [];
  collection = Object.assign(new EventEmitter(), {
    find: () => ({ fetch: () => records }),
    removeMany: vi.fn(() => {
      records = [];
      writeFileSync(join(directory, "local/config.json"), "[]");
      queueMicrotask(() => collection.emit("persistence.pushCompleted"));
    }),
    resetData: vi.fn(async () => {
      records = JSON.parse(
        readFileSync(join(directory, "local/config.json"), "utf8"),
      );
    }),
  });
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

it("protects the whole connection, preserves optional/empty fields, and reopens after restart", async () => {
  const connection = await import("@electron/vault/connection");
  connection.saveConnection("vlt_local", storage);
  expect(JSON.stringify([...mocks.saved.values()])).not.toContain(
    "provider-password",
  );
  vi.resetModules();
  const restarted = await import("@electron/vault/connection");
  expect(restarted.getConnection("vlt_local")).toEqual(storage);
  expect(restarted.getConnection("vlt_other")).toBeNull();
  const summary = await restarted.getConnectionSummary({
    vaultId: "vlt_local",
  });
  expect(summary).toEqual({
    fields: [{ key: "endpoint", value: "https://example.test" }],
  });
});

it.each([
  "unavailable",
  "encryption",
  "write",
])("uses session-only values on %s failure", async (failure) => {
  mocks.available = failure !== "unavailable";
  mocks.failEncrypt = failure === "encryption";
  mocks.failSave = failure === "write";
  const connection = await import("@electron/vault/connection");
  connection.saveConnection("vlt_local", storage);
  connection.saveConnection("vlt_other", {
    type: "filesystem",
    config: { path: "fixture-other" },
  });
  expect(connection.getConnection("vlt_local")).toEqual(storage);
  expect(mocks.saved.size).toBe(0);
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({
      reason:
        failure === "write"
          ? "SAVE_FAILED"
          : failure === "encryption"
            ? "PROTECTION_FAILED"
            : "UNAVAILABLE",
    }),
  );
  vi.resetModules();
  expect(
    (await import("@electron/vault/connection")).getConnection("vlt_local"),
  ).toBeNull();
});

it("preserves locked ciphertext and reports re-entry", async () => {
  (await import("@electron/vault/connection")).saveConnection(
    "vlt_local",
    storage,
  );
  const saved = mocks.saved.get("connections.vlt_local");
  vi.resetModules();
  mocks.available = false;
  expect(
    (await import("@electron/vault/connection")).getConnection("vlt_local"),
  ).toBeNull();
  expect(mocks.saved.get("connections.vlt_local")).toBe(saved);
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ needsCredentials: true }),
  );
});

it.each([
  true,
  false,
])("migrates legacy core JSON atomically with protection available=%s", async (available) => {
  mocks.available = available;
  const file = join(directory, "vlt_local.config");
  writeFileSync(file, JSON.stringify({ ...metadata, storage }));
  const connection = await import("@electron/vault/connection");
  expect(await connection.prepareConnection("vlt_local")).toEqual(storage);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
    ...metadata,
    managedStorage: true,
  });
  expect(readdirSync(directory)).toEqual(["vlt_local.config"]);
  vi.resetModules();
  expect(
    await (await import("@electron/vault/connection")).prepareConnection(
      "vlt_local",
    ),
  ).toEqual(available ? storage : null);
});

it("recovers an interruption after protected save but before replacement", async () => {
  const file = join(directory, "vlt_local.config");
  const original = JSON.stringify({ ...metadata, storage });
  writeFileSync(file, original);
  mocks.failRename = true;
  await expect(
    (await import("@electron/vault/connection")).prepareConnection("vlt_local"),
  ).rejects.toThrow("migration or cleanup");
  expect(readFileSync(file, "utf8")).toBe(original);
  expect(mocks.saved.has("connections.vlt_local")).toBe(true);
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ cleanupFailed: true }),
  );
  vi.resetModules();
  mocks.failRename = false;
  expect(
    await (await import("@electron/vault/connection")).prepareConnection(
      "vlt_local",
    ),
  ).toEqual(storage);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
    ...metadata,
    managedStorage: true,
  });
});

it("leaves unsupported metadata intact rather than losing settings", async () => {
  const file = join(directory, "vlt_local.config");
  const original = JSON.stringify({
    ...metadata,
    storage,
    unknownFutureSetting: 1,
  });
  writeFileSync(file, original);
  await expect(
    (await import("@electron/vault/connection")).prepareConnection("vlt_local"),
  ).rejects.toThrow("migration or cleanup");
  expect(readFileSync(file, "utf8")).toBe(original);
  expect(mocks.saved.size).toBe(0);
});

it("retains an unreadable inherited envelope and waits for persisted cleanup after successful migration", async () => {
  const { encryptVaultConfig } = await import("@electron/encryption");
  records = [
    {
      id: "cfg_fixture",
      vaultId: "vlt_local",
      level: "VAULT",
      createdAt: new Date().toISOString(),
      data: await encryptVaultConfig({
        password: " exact legacy password ",
        config: {
          url: "https://example.test",
          user: "provider-user",
          password: "provider-password",
        },
      }),
    },
  ];
  const connection = await import("@electron/vault/connection");
  expect(await connection.prepareConnection("vlt_local", "wrong")).toBeNull();
  expect(records).toHaveLength(1);
  expect(
    await connection.prepareConnection("vlt_local", " exact legacy password "),
  ).toMatchObject({ type: "webdav" });
  expect(records).toHaveLength(1);
  collection.removeMany.mockImplementation(() => {});
  let finished = false;
  const cleanup = connection
    .completeConnectionMigration("vlt_local")
    .then(() => {
      finished = true;
    });
  await Promise.resolve();
  expect(finished).toBe(false);
  collection.emit("persistence.transmitted");
  await Promise.resolve();
  expect(finished).toBe(false);
  mkdirSync(join(directory, "local"));
  writeFileSync(join(directory, "local/config.json"), "[]");
  collection.emit("persistence.pushCompleted");
  await cleanup;
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ cleanupFailed: false, needsCredentials: false }),
  );
});

it.each([
  "write",
  "readback",
])("keeps cleanup visible and retryable after an envelope %s failure", async (failure) => {
  records = [
    {
      id: "cfg_fixture",
      vaultId: "vlt_local",
      level: "VAULT",
      createdAt: new Date().toISOString(),
      data: { iv: "iv", salt: "salt", cipher: "cipher" },
    },
  ];
  mkdirSync(join(directory, "local"));
  writeFileSync(join(directory, "local/config.json"), JSON.stringify(records));
  const connection = await import("@electron/vault/connection");
  collection.removeMany.mockImplementationOnce(() => {
    records = [];
    queueMicrotask(() =>
      collection.emit(
        failure === "write" ? "persistence.error" : "persistence.pushCompleted",
      ),
    );
  });
  await connection.completeConnectionMigration("vlt_local");
  expect(records).toHaveLength(1);
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ cleanupFailed: true }),
  );
  // Preparing an already-managed core file must not hide the envelope failure.
  writeFileSync(
    join(directory, "vlt_local.config"),
    JSON.stringify({ ...metadata, managedStorage: true }),
  );
  await connection.prepareConnection("vlt_local");
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ cleanupFailed: true }),
  );
  await connection.completeConnectionMigration("vlt_local");
  expect(
    JSON.parse(readFileSync(join(directory, "local/config.json"), "utf8")),
  ).toEqual([]);
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ cleanupFailed: false }),
  );
});

it("redacts URL components, JSON secrets, exact passwords and encoded forms", async () => {
  const connection = await import("@electron/vault/connection");
  connection.rememberConnectionSecrets(
    "vlt_local",
    storage,
    " exact password ",
  );
  const result = connection.redactConnectionError(
    "vlt_local",
    `URL-password URL-token provider-password ${Buffer.from("provider-password").toString("base64")}  exact password `,
  );
  for (const secret of [
    "URL-password",
    "URL-token",
    "provider-password",
    "exact password",
  ])
    expect(result).not.toContain(secret);
});

it("preserves malformed inherited records and permits manual credential recovery", async () => {
  records = [
    { id: "cfg_damaged", vaultId: "vlt_local", level: "VAULT", data: null },
  ];
  mkdirSync(join(directory, "local"));
  const file = join(directory, "local/config.json");
  const original = JSON.stringify(records);
  writeFileSync(file, original);
  const connection = await import("@electron/vault/connection");
  expect(
    await connection.prepareConnection("vlt_local", "password"),
  ).toBeNull();
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ needsCredentials: true }),
  );
  connection.saveConnection("vlt_local", storage);
  expect(await connection.prepareConnection("vlt_local")).toEqual(storage);
  await connection.completeConnectionMigration("vlt_local");
  expect(collection.removeMany).not.toHaveBeenCalled();
  expect(readFileSync(file, "utf8")).toBe(original);
  expect(mocks.status).toHaveBeenLastCalledWith(
    expect.objectContaining({ cleanupFailed: true }),
  );
});
