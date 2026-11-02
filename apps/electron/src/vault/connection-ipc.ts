import {
  ZConnectVaultRequest,
  ZCreateVaultRequest,
  ZProviderConnection,
  ZUnlockVaultRequest,
  ZValidateConnection,
} from "@blinkdisk/schemas/connection";
import { ZPasswordVault } from "@blinkdisk/schemas/password";
import { collections } from "@electron/db";
import { requireMainWindow } from "@electron/ipc-context";
import {
  getConnectionSummary,
  hasSavedConnection,
} from "@electron/vault/connection";
import {
  connectVault,
  createVault,
  unlockVault,
  vaults,
} from "@electron/vault/manage";
import { validateVaultConfig } from "@electron/vault/validate";
import { ipcMain } from "electron";
import type { z } from "zod";

const operations = new Set<string>();
function parse<T>(schema: z.ZodType<T>, args: unknown[]): T {
  if (args.length !== 1) throw new Error("Invalid connection request");
  const result = schema.safeParse(args[0]);
  if (!result.success) throw new Error("Invalid connection request");
  return result.data;
}
function requireLocalVault(id: string) {
  if (!collections.local?.vault.findOne({ id, status: "ACTIVE" }))
    throw new Error("Local vault not found");
}
async function exclusive<T>(
  id: string,
  operation: () => Promise<T>,
  isNew = false,
) {
  if (operations.has(id)) throw new Error("Vault connection is busy");
  if (
    isNew &&
    (id === "temporary" ||
      vaults[id] ||
      collections.local?.vault.findOne({ id }) ||
      hasSavedConnection(id))
  )
    throw new Error("Vault connection already exists");
  operations.add(id);
  try {
    return await operation();
  } finally {
    operations.delete(id);
  }
}

ipcMain.handle("vault.validate", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  const value = parse(ZValidateConnection, args);
  parse(ZProviderConnection, [{ provider: value.type, config: value.config }]);
  return validateVaultConfig(value);
});
ipcMain.handle("vault.create", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  const value = parse(ZCreateVaultRequest, args);
  return exclusive(value.vault.id, () => createVault(value), true);
});
ipcMain.handle("vault.connect", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  const value = parse(ZConnectVaultRequest, args);
  return exclusive(value.id, () => connectVault(value), true);
});
ipcMain.handle("vault.unlock", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  const value = parse(ZUnlockVaultRequest, args);
  requireLocalVault(value.vaultId);
  return exclusive(value.vaultId, () => unlockVault(value));
});
ipcMain.handle("vault.connectionSummary", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  const value = parse(ZPasswordVault, args);
  requireLocalVault(value.vaultId);
  return getConnectionSummary(value);
});
