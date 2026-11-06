// Initialize the bridge before importing components with module-level stores.
export const storageSpaces = new Map([
  ["vault-a", { status: "AVAILABLE", availableBytes: 250_000_000_000 }],
  ["vault-b", { status: "UNSUPPORTED" }],
]);
export const vaultStatuses = new Map();
export const reconnects = [];
const preferences = { vaultColors: {} };
const listeners = new Set();
window.electron = {
  store: {
    get: () => ({ preferences: structuredClone(preferences) }),
    set: async (key, value) => {
      if (key !== "preferences.vaultColors")
        throw new Error("Unexpected preference write");
      preferences.vaultColors = structuredClone(value);
      for (const listener of listeners) listener();
    },
    change: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
  vault: {
    status: async (id) => ({ status: vaultStatuses.get(id) || "RUNNING" }),
    retry: async (id) => {
      reconnects.push(id);
      vaultStatuses.set(id, "RUNNING");
    },
    connectionSummary: async ({ vaultId }) => ({
      fields:
        vaultId === "vault-a"
          ? [{ key: "path", value: "D:\\DiskPond\\Backups" }]
          : [
              { key: "bucket", value: "backups" },
              { key: "prefix", value: "diskpond/" },
              { key: "endpoint", value: `https://${vaultId}.example.test` },
            ],
    }),
    storageSpace: async ({ vaultId }) => {
      const space = storageSpaces.get(vaultId);
      if (space === "ERROR") throw new Error("Storage query failed");
      return space ?? { status: "UNSUPPORTED" };
    },
  },
  path: { basename: async (path) => path.split(/[\\/]/).at(-1) },
  platform: async () => "windows",
};
