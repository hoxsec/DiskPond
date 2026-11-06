import { LOCAL_ACCOUNT_ID } from "@diskpond/constants/account";
import { store } from "@electron/store";

export function openWorkspace() {
  store.set({ currentAccountId: LOCAL_ACCOUNT_ID, workspaceReady: true });
}
