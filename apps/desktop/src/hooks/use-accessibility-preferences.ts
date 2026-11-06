import { useAppStorage } from "@desktop/hooks/use-app-storage";
import { useLayoutEffect } from "react";

export function useAccessibilityPreferences() {
  const [interfaceScale] = useAppStorage("preferences.interfaceScale", "1");
  const [reduceMotion] = useAppStorage("preferences.reduceMotion", false);

  useLayoutEffect(() => {
    window.electron.zoom(Number(interfaceScale));
  }, [interfaceScale]);

  useLayoutEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);
}
