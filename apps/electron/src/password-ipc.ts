import { ZPasswordVault, ZSetVaultPassword } from "@diskpond/schemas/password";
import { collections } from "@electron/db";
import { requireMainWindow } from "@electron/ipc-context";
import {
  getPasswordCache,
  getPasswordStorageStatus,
  setPasswordCache,
} from "@electron/password";
import { ipcMain } from "electron";

function requireLocalVault(vaultId: string) {
  if (!collections.local?.vault.findOne({ id: vaultId }))
    throw new Error("Local vault not found");
}

ipcMain.handle("vault.password.status", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  if (args.length) throw new Error("Invalid password status request");
  return getPasswordStorageStatus();
});

ipcMain.handle("vault.password.set", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  const result = ZSetVaultPassword.safeParse(args[0]);
  // Do not return Zod errors containing untrusted password data to IPC/logs.
  if (args.length !== 1 || !result.success)
    throw new Error("Invalid password request");
  requireLocalVault(result.data.vaultId);
  return setPasswordCache(result.data);
});

ipcMain.handle("vault.password.get", (event, ...args: unknown[]) => {
  requireMainWindow(event);
  const result = ZPasswordVault.safeParse(args[0]);
  if (args.length !== 1 || !result.success)
    throw new Error("Invalid password request");
  requireLocalVault(result.data.vaultId);
  return getPasswordCache(result.data);
});
