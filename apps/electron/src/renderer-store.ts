import { LANGUAGE_CODES } from "@diskpond/constants/language";
import { VAULT_COLORS } from "@diskpond/constants/vault-color";
import { ZUpdatePreferences } from "@diskpond/schemas/settings";
import { setLaunchAtLogin } from "@electron/startup";
import { store } from "@electron/store";
import { z } from "zod";

const writable = {
  "preferences.checkForUpdates": z.boolean(),
  "preferences.launchAtLogin": ZUpdatePreferences.shape.launchAtLogin,
  "preferences.keepRunningInBackground":
    ZUpdatePreferences.shape.keepRunningInBackground,
  "preferences.interfaceScale": ZUpdatePreferences.shape.interfaceScale,
  "preferences.reduceMotion": ZUpdatePreferences.shape.reduceMotion,
  "preferences.theme": z.enum(["system", "light", "dark"]),
  "preferences.language": z.enum(LANGUAGE_CODES),
  "preferences.mode": z.enum(["basic", "advanced"]),
  "preferences.vaultColors": z.record(
    z.string().min(1).max(244),
    z.enum(VAULT_COLORS),
  ),
  dismissedUpdateVersion: z.string().nullable(),
  "accounts.local.lastUsedVaultId": z.string().nullable(),
};

// Never expose passwords, dormant hosted records or migration state through
// the inherited settings bridge, and never let it bypass password protection.
export function readRendererStore(key?: unknown): unknown {
  const snapshot = {
    workspaceReady: store.get("workspaceReady"),
    preferences: {
      checkForUpdates: store.get("preferences.checkForUpdates"),
      launchAtLogin: store.get("preferences.launchAtLogin"),
      keepRunningInBackground: store.get("preferences.keepRunningInBackground"),
      interfaceScale: store.get("preferences.interfaceScale"),
      reduceMotion: store.get("preferences.reduceMotion"),
      theme: store.get("preferences.theme"),
      language: store.get("preferences.language"),
      mode: store.get("preferences.mode"),
      vaultColors: store.get("preferences.vaultColors"),
    },
    dismissedUpdateVersion: store.get("dismissedUpdateVersion"),
    accounts: {
      local: { lastUsedVaultId: store.get("accounts.local.lastUsedVaultId") },
    },
  };
  if (key === undefined) return snapshot;
  if (typeof key !== "string") return undefined;
  return key
    .split(".")
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === "object" && Object.hasOwn(value, part)
          ? Reflect.get(value, part)
          : undefined,
      snapshot,
    );
}

export function writeRendererStore(key: unknown, value: unknown) {
  if (typeof key !== "string" || !Object.hasOwn(writable, key))
    throw new Error("Invalid preference request");
  const schema = writable[key as keyof typeof writable];
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid preference value");
  if (key === "preferences.launchAtLogin")
    return setLaunchAtLogin(parsed.data as boolean);
  store.set(key, parsed.data);
}
