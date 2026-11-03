import { lstatSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import {
  type PasswordStorageStatus,
  ZPasswordVault,
  ZSetVaultPassword,
  ZStoredPassword,
} from "@blinkdisk/schemas/password";
import {
  decryptString,
  encryptString,
  isSecureStorageAvailable,
} from "@electron/encryption";
import { log } from "@electron/log";
import { globalVaultDirectory } from "@electron/path";
import { store } from "@electron/store";
import { sendWindow } from "@electron/window";

const sessionPasswords = new Map<string, string>();
const unreadablePasswords = new Set<string>();
let reason: PasswordStorageStatus["reason"] = null;
let cleanupFailed = false;
let connectionState = {
  reason: null as PasswordStorageStatus["reason"],
  needsCredentials: false,
  cleanupFailed: false,
};

export function updateConnectionStorageStatus(state: typeof connectionState) {
  connectionState = state;
  notify();
}

export function getPasswordStorageStatus(): PasswordStorageStatus {
  const available = isSecureStorageAvailable();
  return {
    mode:
      available && !reason && !connectionState.reason ? "PROTECTED" : "SESSION",
    reason: available ? reason || connectionState.reason : "UNAVAILABLE",
    needsPassword:
      unreadablePasswords.size > 0 || connectionState.needsCredentials,
    cleanupFailed: cleanupFailed || connectionState.cleanupFailed,
  };
}

function notify() {
  sendWindow("vault.password.change", getPasswordStorageStatus());
}

function removeStoredPassword(vaultId: string) {
  try {
    store.delete(`passwords.${vaultId}`);
  } catch {
    cleanupFailed = true;
    log.warn("An old password cache could not be removed");
  }
}

export function setPasswordCache({
  vaultId,
  password,
}: {
  vaultId: string;
  password: string;
}) {
  ZSetVaultPassword.parse({ vaultId, password });
  sessionPasswords.set(vaultId, password);
  unreadablePasswords.delete(vaultId);
  const encrypted = reason ? null : encryptString(password);
  if (encrypted) {
    try {
      store.set(`passwords.${vaultId}`, encrypted);
    } catch {
      reason = "SAVE_FAILED";
      removeStoredPassword(vaultId);
      log.warn("Password cache could not be saved; using session-only storage");
    }
  } else {
    reason ||= isSecureStorageAvailable() ? "PROTECTION_FAILED" : "UNAVAILABLE";
    removeStoredPassword(vaultId);
  }
  notify();
  return getPasswordStorageStatus();
}

export function getPasswordCache({ vaultId }: { vaultId: string }) {
  ZPasswordVault.parse({ vaultId });
  const session = sessionPasswords.get(vaultId);
  if (session !== undefined) return session;

  let stored: unknown;
  try {
    stored = store.get(`passwords.${vaultId}`);
  } catch {
    unreadablePasswords.add(vaultId);
    notify();
    return null;
  }
  if (stored === undefined || stored === null) return null;
  const parsed = ZStoredPassword.safeParse(stored);
  if (
    parsed.success &&
    parsed.data.type === "PLAIN" &&
    parsed.data.data.length > 0 &&
    parsed.data.data.length <= 65_536
  ) {
    // Local-only upgrade: protect the value or retain it in memory, then remove
    // the unsafe persistent copy. The repository/config encryption is unchanged.
    setPasswordCache({ vaultId, password: parsed.data.data });
    return parsed.data.data;
  }
  const password = parsed.success ? decryptString(parsed.data) : null;
  if (password !== null) {
    sessionPasswords.set(vaultId, password);
    if (unreadablePasswords.delete(vaultId)) notify();
  } else {
    unreadablePasswords.add(vaultId);
    notify();
  }
  return password;
}

// Only called for registered local vaults. Never scan or import dormant hosted
// collections, other application profiles or arbitrary files.
export function preparePasswordCache(vaultId: string) {
  ZPasswordVault.parse({ vaultId });
  let password = getPasswordCache({ vaultId });
  for (const suffix of ["kopia-password", "blinkdisk-password"]) {
    const file = resolve(globalVaultDirectory(), `${vaultId}.config.${suffix}`);
    try {
      const info = lstatSync(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 90_000)
        throw new Error("Invalid legacy password file");
      const encoded = readFileSync(file, "utf8").trim();
      const decoded = Buffer.from(encoded, "base64");
      if (
        !encoded ||
        decoded.toString("base64") !== encoded ||
        !Buffer.from(decoded.toString("utf8")).equals(decoded)
      )
        throw new Error("Invalid legacy password encoding");
      if (!password) {
        password = decoded.toString("utf8");
        setPasswordCache({ vaultId, password });
      }
      unlinkSync(file);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
        continue;
      cleanupFailed = true;
      log.warn("A legacy engine password file could not be removed");
    }
  }
  notify();
  return password;
}
