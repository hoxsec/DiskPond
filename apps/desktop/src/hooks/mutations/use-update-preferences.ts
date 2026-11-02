import type { ZUpdatePreferencesType } from "@blinkdisk/schemas/settings";
import { showErrorToast } from "@blinkdisk/utils/error-toast";
import { useTheme } from "@desktop/hooks/use-theme";
import { i18n } from "@desktop/i18n";
import { useMutation } from "@tanstack/react-query";

export function useUpdatePreferences(onSuccess: () => void) {
  const { setTheme } = useTheme();
  return useMutation({
    mutationKey: ["workspace", "preferences"],
    mutationFn: async (values: ZUpdatePreferencesType) => {
      await setTheme(values.theme);
      await window.electron.store.set("preferences.language", values.language);
      await i18n.changeLanguage(values.language);
    },
    onError: showErrorToast,
    onSuccess,
  });
}
