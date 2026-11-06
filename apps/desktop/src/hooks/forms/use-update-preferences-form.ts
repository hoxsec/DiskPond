import { useUpdatePreferences } from "@desktop/hooks/mutations/use-update-preferences";
import { i18n } from "@desktop/i18n";
import { DEFAULT_LANGUAGE_CODE } from "@diskpond/constants/language";
import { useAppForm } from "@diskpond/forms/use-app-form";
import {
  ZUpdatePreferences,
  type ZUpdatePreferencesType,
} from "@diskpond/schemas/settings";
import { useState } from "react";

function readPreferences(): ZUpdatePreferencesType {
  const schema = ZUpdatePreferences.shape;
  const get = window.electron.store.get;
  return {
    theme: schema.theme.catch("system").parse(get("preferences.theme")),
    language: schema.language
      .catch(DEFAULT_LANGUAGE_CODE)
      .parse(i18n.resolvedLanguage),
    checkForUpdates: get("preferences.checkForUpdates") !== false,
    launchAtLogin:
      window.electron.app.isPackaged() &&
      get("preferences.launchAtLogin") !== false,
    keepRunningInBackground:
      get("preferences.keepRunningInBackground") !== false,
    interfaceScale: schema.interfaceScale
      .catch("1")
      .parse(get("preferences.interfaceScale")),
    reduceMotion: get("preferences.reduceMotion") === true,
    mode: schema.mode.catch("basic").parse(get("preferences.mode")),
  };
}

export function useUpdatePreferencesForm() {
  const { mutateAsync } = useUpdatePreferences();
  const [defaultValues, setDefaultValues] = useState(readPreferences);

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ZUpdatePreferences,
    },
    listeners: {
      onChange: ({ formApi }) => {
        if (formApi.state.isValid) formApi.handleSubmit();
      },
    },
    onSubmit: async ({ value }) => {
      try {
        await mutateAsync(value);
        setDefaultValues(value);
        form.reset(value);
      } catch {
        // The mutation shows the error; restore the controls to saved values.
        const saved = readPreferences();
        setDefaultValues(saved);
        form.reset(saved);
      }
    },
  });

  return form;
}
