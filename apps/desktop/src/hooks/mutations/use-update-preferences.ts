import { i18n } from "@desktop/i18n";
import type { ZUpdatePreferencesType } from "@diskpond/schemas/settings";
import { showErrorToast } from "@diskpond/utils/error-toast";
import { useMutation } from "@tanstack/react-query";

export function useUpdatePreferences() {
  return useMutation({
    mutationKey: ["workspace", "preferences"],
    mutationFn: async (values: ZUpdatePreferencesType) => {
      for (const key of Object.keys(
        values,
      ) as (keyof ZUpdatePreferencesType)[]) {
        if (key === "launchAtLogin" && !window.electron.app.isPackaged())
          continue;

        const storageKey = `preferences.${key}` as const;
        if (window.electron.store.get(storageKey) !== values[key])
          await window.electron.store.set(storageKey, values[key]);

        if (key === "language" && i18n.resolvedLanguage !== values.language)
          await i18n.changeLanguage(values.language);
      }
    },
    onError: showErrorToast,
  });
}
