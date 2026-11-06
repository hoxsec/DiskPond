import { ZVaultEncryptedConfig } from "@diskpond/schemas/config";
import { log } from "@electron/log";
import { safeStorage } from "electron";

// PLAIN is accepted only when migrating an existing local password cache.
export type EncryptedString = {
  type: "ENCRYPTED" | "PLAIN";
  data: string;
};

export function isSecureStorageAvailable() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    if (process.platform !== "linux") return true;
    return ["gnome_libsecret", "kwallet", "kwallet5", "kwallet6"].includes(
      safeStorage.getSelectedStorageBackend(),
    );
  } catch {
    return false;
  }
}

export function encryptString(data: string): EncryptedString | null {
  if (!isSecureStorageAvailable()) return null;
  try {
    const encrypted = safeStorage.encryptString(data);
    // Availability alone does not establish that the key store is working.
    if (safeStorage.decryptString(encrypted) !== data) return null;
    return { type: "ENCRYPTED", data: encrypted.toString("base64") };
  } catch {
    log.warn("OS credential protection failed; using session-only storage");
    return null;
  }
}

export function decryptString(data: EncryptedString): string | null {
  if (data.type !== "ENCRYPTED" || !isSecureStorageAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(data.data, "base64"));
  } catch {
    log.warn(
      "Saved vault credentials could not be unlocked; re-entry required",
    );
    return null;
  }
}

export type EncryptedConfig = {
  iv: string;
  salt: string;
  cipher: string;
};

// Read only the inherited envelope format: 12-byte IV, 16-byte salt and the
// existing 10,000-character ciphertext limit. Bound input before decoding/KDF.
const ZLegacyEnvelope = ZVaultEncryptedConfig.extend({
  iv: ZVaultEncryptedConfig.shape.iv.length(16),
  salt: ZVaultEncryptedConfig.shape.salt.length(24),
});

export async function encryptVaultConfig({
  password,
  config,
}: {
  password: string;
  config: object;
}): Promise<EncryptedConfig> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encodedData = encoder.encode(JSON.stringify(config));

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData,
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    cipher: btoa(String.fromCharCode(...new Uint8Array(cipher))),
  };
}

export async function decryptVaultConfig({
  password,
  encrypted,
}: {
  password: string;
  encrypted: EncryptedConfig;
}): Promise<object> {
  if (!ZLegacyEnvelope.safeParse(encrypted).success)
    throw new Error("Invalid saved provider envelope");
  const decoder = new TextDecoder();

  const salt = Uint8Array.from(atob(encrypted.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encrypted.iv), (c) => c.charCodeAt(0));
  const cipher = Uint8Array.from(atob(encrypted.cipher), (c) =>
    c.charCodeAt(0),
  );
  if (salt.length !== 16 || iv.length !== 12 || cipher.length < 16)
    throw new Error("Invalid saved provider envelope");

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipher,
  );

  return JSON.parse(decoder.decode(decrypted));
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
