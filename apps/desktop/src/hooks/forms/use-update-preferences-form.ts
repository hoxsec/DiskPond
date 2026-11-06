import { useUpdatePreferences } from "@desktop/hooks/mutations/use-update-preferences";
import { useTheme } from "@desktop/hooks/use-theme";
import { i18n } from "@desktop/i18n";
import {
  DEFAULT_LANGUAGE_CODE,
  type LanguageCode,
} from "@diskpond/constants/language";
import { useAppForm } from "@diskpond/forms/use-app-form";
import { ZUpdatePreferences } from "@diskpond/schemas/settings";

export function useUpdatePreferencesForm() {
  const { theme } = useTheme();
  const { mutateAsync } = useUpdatePreferences(() => form.reset());

  const form = useAppForm({
    defaultValues: {
      theme: theme,
      language: (i18n.resolvedLanguage ??
        DEFAULT_LANGUAGE_CODE) as LanguageCode,
      checkForUpdates:
        window.electron.store.get("preferences.checkForUpdates") !== false,
    },
    validators: {
      onSubmit: ZUpdatePreferences,
    },
    listeners: {
      onChange: ({ formApi }) => {
        if (formApi.state.isValid) formApi.handleSubmit();
      },
    },
    onSubmit: async ({ value }) => await mutateAsync(value),
  });

  return form;
}
