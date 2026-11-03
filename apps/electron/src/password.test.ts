const mocks = vi.hoisted(() => {
  const saved = new Map<string, unknown>();
  return {
    saved,
    store: {
      get: vi.fn((key: string) => saved.get(key)),
      set: vi.fn((key: string, value: unknown) => {
        saved.set(key, value);
      }),
      delete: vi.fn((key: string) => {
        saved.delete(key);
      }),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
      encryptString: vi.fn((value: string) =>
        Buffer.from(`protected:${value}`),
      ),
      decryptString: vi.fn((value: Buffer) =>
        value.toString().replace(/^protected:/, ""),
      ),
      setUsePlainTextEncryption: vi.fn(),
    },
    notify: vi.fn(),
    warn: vi.fn(),
  };
});

vi.mock("@electron/store", () => ({ store: mocks.store }));
vi.mock("electron", () => ({ safeStorage: mocks.safeStorage }));
vi.mock("@electron/window", () => ({ sendWindow: mocks.notify }));
vi.mock("@electron/log", () => ({ log: { warn: mocks.warn } }));
vi.mock("@electron/path", () => ({ globalVaultDirectory: () => directory }));

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let directory: string;
const originalPlatform = process.platform;
const payload = { vaultId: "vlt_local", password: "unique-password-雪" };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.saved.clear();
  mocks.safeStorage.isEncryptionAvailable.mockReturnValue(true);
  directory = mkdtempSync(
    join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-password-"),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(process, "platform", { value: originalPlatform });
  rmSync(directory, { recursive: true, force: true });
});

it("round-trips a protected password across a fresh module/session", async () => {
  const cache = await import("@electron/password");
  expect(cache.setPasswordCache(payload).mode).toBe("PROTECTED");
  expect(mocks.saved.get("passwords.vlt_local")).toMatchObject({
    type: "ENCRYPTED",
  });
  vi.resetModules();
  const restarted = await import("@electron/password");
  expect(restarted.getPasswordCache(payload)).toBe(payload.password);
  expect(mocks.safeStorage.setUsePlainTextEncryption).not.toHaveBeenCalled();
});

it("keeps separate passwords in memory only when protection is unavailable", async () => {
  mocks.safeStorage.isEncryptionAvailable.mockReturnValue(false);
  const cache = await import("@electron/password");
  expect(cache.setPasswordCache(payload)).toMatchObject({
    mode: "SESSION",
    reason: "UNAVAILABLE",
  });
  cache.setPasswordCache({ vaultId: "vlt_other", password: "other-password" });
  expect(cache.getPasswordCache(payload)).toBe(payload.password);
  expect(cache.getPasswordCache({ vaultId: "vlt_other" })).toBe(
    "other-password",
  );
  expect(mocks.saved.size).toBe(0);
  expect(mocks.safeStorage.encryptString).not.toHaveBeenCalled();
  vi.resetModules();
  expect(
    (await import("@electron/password")).getPasswordCache(payload),
  ).toBeNull();
});

it.each([
  "basic_text",
  "unknown",
  "new-unverified-backend",
])("rejects Linux's %s backend even when encryption reports available", async (backend) => {
  Object.defineProperty(process, "platform", { value: "linux" });
  mocks.safeStorage.getSelectedStorageBackend
    .mockReturnValueOnce(backend)
    .mockReturnValueOnce(backend)
    .mockReturnValueOnce(backend)
    .mockReturnValueOnce(backend);
  const cache = await import("@electron/password");
  expect(cache.setPasswordCache(payload).mode).toBe("SESSION");
  expect(mocks.safeStorage.encryptString).not.toHaveBeenCalled();
  expect(mocks.saved.size).toBe(0);
});

it.each([
  "encrypt",
  "decrypt",
  "mismatch",
])("uses memory if the OS protection round-trip fails at %s, without logging the secret", async (failure) => {
  if (failure === "encrypt")
    mocks.safeStorage.encryptString.mockImplementationOnce(() => {
      throw new Error(payload.password);
    });
  if (failure === "decrypt")
    mocks.safeStorage.decryptString.mockImplementationOnce(() => {
      throw new Error(payload.password);
    });
  if (failure === "mismatch")
    mocks.safeStorage.decryptString.mockReturnValueOnce("different");
  const cache = await import("@electron/password");
  expect(cache.setPasswordCache(payload)).toMatchObject({
    mode: "SESSION",
    reason: "PROTECTION_FAILED",
  });
  expect(cache.getPasswordCache(payload)).toBe(payload.password);
  expect(mocks.saved.size).toBe(0);
  expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(payload.password);
});

it("retains unreadable protected records and requests password re-entry without crashing", async () => {
  const record = { type: "ENCRYPTED", data: "broken-ciphertext" };
  mocks.saved.set("passwords.vlt_local", record);
  mocks.safeStorage.decryptString.mockImplementationOnce(() => {
    throw new Error(payload.password);
  });
  const cache = await import("@electron/password");
  expect(cache.getPasswordCache(payload)).toBeNull();
  expect(cache.getPasswordStorageStatus().needsPassword).toBe(true);
  expect(mocks.saved.get("passwords.vlt_local")).toEqual(record);
  cache.setPasswordCache(payload);
  expect(cache.getPasswordStorageStatus().needsPassword).toBe(false);
  expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(payload.password);
});

it("handles malformed cache records and unavailable reads as re-entry, not successful unlocks", async () => {
  mocks.saved.set("passwords.vlt_local", { data: "untyped-secret" });
  const cache = await import("@electron/password");
  expect(cache.getPasswordCache(payload)).toBeNull();
  mocks.store.get.mockImplementationOnce(() => {
    throw new Error("unreadable");
  });
  expect(cache.getPasswordCache({ vaultId: "vlt_other" })).toBeNull();
  expect(cache.getPasswordStorageStatus().needsPassword).toBe(true);
});

it.each([
  true,
  false,
])("upgrades local PLAIN caches with protection available=%s, without touching other entries", async (available) => {
  mocks.safeStorage.isEncryptionAvailable.mockReturnValue(available);
  mocks.saved.set("passwords.vlt_local", {
    type: "PLAIN",
    data: payload.password,
  });
  const dormant = { type: "PLAIN", data: "dormant-hosted-value" };
  mocks.saved.set("passwords.vlt_dormant", dormant);
  const cache = await import("@electron/password");
  expect(cache.preparePasswordCache(payload.vaultId)).toBe(payload.password);
  expect(mocks.saved.get("passwords.vlt_local")).toEqual(
    available ? expect.objectContaining({ type: "ENCRYPTED" }) : undefined,
  );
  expect(mocks.saved.get("passwords.vlt_dormant")).toEqual(dormant);
});

it("moves both legacy engine password filenames into the local cache and removes the unprotected copies", async () => {
  const legacy = join(directory, "vlt_local.config.blinkdisk-password");
  const current = join(directory, "vlt_local.config.kopia-password");
  writeFileSync(legacy, Buffer.from(payload.password).toString("base64"));
  writeFileSync(current, Buffer.from(payload.password).toString("base64"));
  const dormant = join(directory, "vlt_dormant.config.kopia-password");
  writeFileSync(dormant, "dormant");
  const cache = await import("@electron/password");
  expect(cache.preparePasswordCache(payload.vaultId)).toBe(payload.password);
  expect(existsSync(legacy)).toBe(false);
  expect(existsSync(current)).toBe(false);
  expect(readFileSync(dormant, "utf8")).toBe("dormant");
  expect(cache.preparePasswordCache(payload.vaultId)).toBe(payload.password);
});

it("reports cache write and cleanup failures while retaining the current session password", async () => {
  mocks.store.set.mockImplementationOnce(() => {
    throw new Error(payload.password);
  });
  mocks.store.delete.mockImplementationOnce(() => {
    throw new Error(payload.password);
  });
  const cache = await import("@electron/password");
  expect(cache.setPasswordCache(payload)).toMatchObject({
    mode: "SESSION",
    reason: "SAVE_FAILED",
    cleanupFailed: true,
  });
  expect(cache.getPasswordCache(payload)).toBe(payload.password);
  expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(payload.password);
});

it("reports an unremovable legacy path without reading or overwriting it", async () => {
  const legacy = join(directory, "vlt_local.config.kopia-password");
  mkdirSync(legacy);
  const cache = await import("@electron/password");
  expect(cache.preparePasswordCache(payload.vaultId)).toBeNull();
  expect(cache.getPasswordStorageStatus().cleanupFailed).toBe(true);
  expect(existsSync(legacy)).toBe(true);
});

it("preserves malformed legacy files and reports the cleanup problem", async () => {
  const legacy = join(directory, "vlt_local.config.kopia-password");
  writeFileSync(legacy, "not-base64");
  const cache = await import("@electron/password");
  expect(cache.preparePasswordCache(payload.vaultId)).toBeNull();
  expect(cache.getPasswordStorageStatus().cleanupFailed).toBe(true);
  expect(readFileSync(legacy, "utf8")).toBe("not-base64");
});

it.each([
  "../escape",
  "vlt.a",
  "x/y",
  "x\\y",
  "__proto__",
  "constructor",
])("rejects unsafe vault ID %s", async (vaultId) => {
  const cache = await import("@electron/password");
  expect(() => cache.setPasswordCache({ ...payload, vaultId })).toThrow();
  expect(mocks.store.set).not.toHaveBeenCalled();
});
