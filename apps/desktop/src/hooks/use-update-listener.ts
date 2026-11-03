import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";
import { useEffect } from "react";

export function useUpdateListener() {
  const { setStatus } = useUpdateStatus();

  useEffect(() => {
    let active = true;
    let received = false;
    const unsubscribe = window.electron.update.change((status) => {
      received = true;
      setStatus(status);
    });
    void window.electron.update
      .status()
      .then((status) => {
        if (active && !received) setStatus(status);
      })
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, [setStatus]);
}
