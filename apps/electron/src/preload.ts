import type { PasswordStorageStatus } from "@blinkdisk/schemas/password";
import { setupSignalDBPreload } from "@blinkdisk/signaldb-electron/preload";
import type {
  getConnectionSummary,
  getVaultStorageSpace,
} from "@electron/vault/connection";

setupSignalDBPreload(ipcRenderer, contextBridge);

import type { readClipboard } from "@electron/clipboard";
import type { sourceType } from "@electron/fs";
import type { getPasswordCache, setPasswordCache } from "@electron/password";
import type {
  checkEmpty,
  listRestores,
  restoreDirectory,
  restoreMultiple,
  restoreSingle,
} from "@electron/restore";
import type { sshKeyscan } from "@electron/ssh";
import type {
  AccountStorageSchema,
  GlobalStorageSchema,
} from "@electron/store";
import type { UpdateStatus } from "@electron/updater";
import type {
  connectVault,
  createVault,
  getVault,
  getVaultStatus,
  retryVault,
  unlockVault,
} from "@electron/vault/manage";
import type { validateVaultConfig } from "@electron/vault/validate";
import {
  contextBridge,
  type IpcRendererEvent,
  ipcRenderer,
  type OpenDialogOptions,
  type OpenDialogReturnValue,
  type SaveDialogOptions,
  type SaveDialogReturnValue,
  webFrame,
  webUtils,
} from "electron";

ipcRenderer.setMaxListeners(240);

function listener<Payload>(event: string) {
  return (callback: (payload: Payload) => void) => {
    function handler(_: IpcRendererEvent, payload: Payload) {
      callback(payload);
    }

    ipcRenderer.on(event, handler);

    return () => {
      ipcRenderer.off(event, handler);
    };
  };
}

const api = {
  app: {
    version: () => ipcRenderer.invoke("app.version") as Promise<string>,
  },
  workspace: {
    open: () => ipcRenderer.invoke("workspace.open") as Promise<void>,
  },
  window: {
    reload: () => ipcRenderer.send("window.reload"),
    console: () => ipcRenderer.send("window.console"),
    setProgressBar: (progress: number) =>
      ipcRenderer.send("window.setProgressBar", progress),
  },
  store: {
    get: (
      key?:
        | keyof GlobalStorageSchema
        | `accounts.${string}.${keyof AccountStorageSchema}`,
    ) => ipcRenderer.sendSync("store.get", key) as unknown,
    set: setStorage,
    change: listener<void>("store.change"),
  },
  clipboard: {
    read: () =>
      ipcRenderer.invoke("clipboard.read") as Promise<
        ReturnType<typeof readClipboard>
      >,
  },
  zoom: (level: number) => webFrame.setZoomFactor(level),
  os: {
    hostName: (vaultId?: string) =>
      ipcRenderer.sendSync("os.hostName", vaultId) as string,
    userName: (vaultId?: string) =>
      ipcRenderer.sendSync("os.userName", vaultId) as string,
    platform: () => ipcRenderer.sendSync("os.platform") as string,
  },
  path: {
    basename: (path: string) =>
      ipcRenderer.invoke("path.basename", path) as Promise<string>,
    dirname: (path: string) =>
      ipcRenderer.invoke("path.dirname", path) as Promise<string>,
  },
  dialog: {
    open: (options: OpenDialogOptions) =>
      ipcRenderer.invoke(
        "dialog.open",
        options,
      ) as Promise<OpenDialogReturnValue>,
    save: (options: SaveDialogOptions & { defaultFileName?: string }) =>
      ipcRenderer.invoke(
        "dialog.save",
        options,
      ) as Promise<SaveDialogReturnValue>,
  },
  fs: {
    folderSize: (path: string) =>
      ipcRenderer.invoke("fs.folderSize", path) as Promise<number>,
    isDirectory: (path: string) =>
      ipcRenderer.invoke("fs.isDirectory", path) as Promise<boolean>,
    sourceType: (path: string) =>
      ipcRenderer.invoke("fs.sourceType", path) as Promise<
        Awaited<ReturnType<typeof sourceType>>
      >,
    sourceSize: (path: string) =>
      ipcRenderer.invoke("fs.sourceSize", path) as Promise<number>,
    getPathFromFile: (file: File) => webUtils.getPathForFile(file),
  },
  vault: {
    storageSpace: (payload: { vaultId: string }) =>
      ipcRenderer.invoke("vault.storageSpace", payload) as ReturnType<
        typeof getVaultStorageSpace
      >,
    connectionSummary: (payload: { vaultId: string }) =>
      ipcRenderer.invoke("vault.connectionSummary", payload) as ReturnType<
        typeof getConnectionSummary
      >,
    validate: (payload: Parameters<typeof validateVaultConfig>[0]) =>
      ipcRenderer.invoke("vault.validate", payload) as Promise<
        ReturnType<typeof validateVaultConfig>
      >,
    create: (payload: Parameters<typeof createVault>[0]) =>
      ipcRenderer.invoke("vault.create", payload) as ReturnType<
        typeof createVault
      >,
    connect: (payload: Parameters<typeof connectVault>[0]) =>
      ipcRenderer.invoke("vault.connect", payload) as Promise<
        Awaited<ReturnType<typeof connectVault>>
      >,
    status: (payload: Parameters<typeof getVault>[0]) =>
      ipcRenderer.invoke("vault.status", payload) as Promise<
        ReturnType<typeof getVaultStatus>
      >,
    retry: (id: Parameters<typeof retryVault>[0]) =>
      ipcRenderer.invoke("vault.retry", id) as ReturnType<typeof retryVault>,
    unlock: (payload: Parameters<typeof unlockVault>[0]) =>
      ipcRenderer.invoke("vault.unlock", payload) as ReturnType<
        typeof unlockVault
      >,
    password: {
      status: () =>
        ipcRenderer.invoke(
          "vault.password.status",
        ) as Promise<PasswordStorageStatus>,
      change: listener<PasswordStorageStatus>("vault.password.change"),
      set: (payload: Parameters<typeof setPasswordCache>[0]) =>
        ipcRenderer.invoke("vault.password.set", payload) as Promise<
          ReturnType<typeof setPasswordCache>
        >,
      get: (payload: Parameters<typeof getPasswordCache>[0]) =>
        ipcRenderer.invoke("vault.password.get", payload) as Promise<
          ReturnType<typeof getPasswordCache>
        >,
    },
    restore: {
      cancel: (payload: { id: string }) =>
        ipcRenderer.invoke("vault.restore.cancel", payload) as Promise<void>,
      dismiss: (payload: { id: string }) =>
        ipcRenderer.invoke("vault.restore.dismiss", payload) as Promise<void>,
      single: (payload: Parameters<typeof restoreSingle>[0]) =>
        ipcRenderer.invoke("vault.restore.single", payload) as Promise<
          ReturnType<typeof restoreSingle>
        >,
      multiple: (payload: Parameters<typeof restoreMultiple>[0]) =>
        ipcRenderer.invoke("vault.restore.multiple", payload) as Promise<
          ReturnType<typeof restoreMultiple>
        >,
      directory: (payload: Parameters<typeof restoreDirectory>[0]) =>
        ipcRenderer.invoke("vault.restore.directory", payload) as Promise<
          ReturnType<typeof restoreDirectory>
        >,
      list: (payload: Parameters<typeof listRestores>[0]) =>
        ipcRenderer.invoke("vault.restore.list", payload) as Promise<
          ReturnType<typeof listRestores>
        >,
      checkEmpty: (payload: Parameters<typeof checkEmpty>[0]) =>
        ipcRenderer.invoke("vault.restore.checkEmpty", payload) as Promise<
          ReturnType<typeof checkEmpty>
        >,
    },
  },
  shell: {
    open: {
      file: (path: string) => ipcRenderer.invoke("shell.open.file", path),
      folder: (path: string) => ipcRenderer.invoke("shell.open.folder", path),
      browser: (url: string) => ipcRenderer.invoke("shell.open.browser", url),
    },
  },
  deeplink: {
    onOpen: listener<{ event: string }>("deeplink.onOpen"),
  },
  ssh: {
    keyscan: (form: Parameters<typeof sshKeyscan>[0]) =>
      ipcRenderer.invoke("ssh.keyscan", form) as ReturnType<typeof sshKeyscan>,
  },
  update: {
    check: () => ipcRenderer.invoke("update.check") as Promise<UpdateStatus>,
    change: listener<UpdateStatus>("update.available"),
    status: () => ipcRenderer.invoke("update.status") as Promise<UpdateStatus>,
    openReleases: () =>
      ipcRenderer.invoke("update.openReleases") as Promise<void>,
  },
};

function setStorage<
  K extends
    | keyof GlobalStorageSchema
    | `accounts.${string}.${keyof AccountStorageSchema}`,
>(key: K, value: unknown): Promise<void> {
  return ipcRenderer.invoke("store.set", key, value);
}

contextBridge.exposeInMainWorld("electron", api);

export type ElectronAPI = typeof api;
