import { existsSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_ACCOUNT_ID } from "@blinkdisk/constants/account";
import { globalAccountDirectory } from "@electron/path";
import { store } from "@electron/store";

export async function migrateWorkspaceV1() {
  // Keep the existing local collection names, preferences and encrypted configs.
  // Cached hosted accounts stay on disk, but are never opened or synchronized.
  store.set({
    currentAccountId: LOCAL_ACCOUNT_ID,
    workspaceReady:
      store.get("workspaceReady") === true ||
      store.get("hasSkippedAuth") === true ||
      existsSync(
        join(globalAccountDirectory(), LOCAL_ACCOUNT_ID, "vault.json"),
      ),
  });
}
