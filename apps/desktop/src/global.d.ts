import type { authClient } from "@diskpond/electron/auth";
import type { ElectronAPI } from "@diskpond/electron/preload";

declare global {
  type Bridges = typeof authClient.$Infer.Bridges;
  interface Window extends Bridges {
    electron: ElectronAPI;
  }
}
