import type { UpdateStatus } from "@blinkdisk/electron/updater";
import { Store, useStore } from "@tanstack/react-store";

const store = new Store<UpdateStatus | null>(null);
const setStatus = (status: UpdateStatus | null) => store.setState(() => status);

export function useUpdateStatus() {
  const status = useStore(store);
  return { status, setStatus };
}
