import {
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
} from "@desktop/components/settings";
import { CheckForUpdates } from "@desktop/components/settings/check-for-updates";
import { PasswordStorageNotice } from "@desktop/components/vaults/password-storage-notice";
import { useUpdatePreferencesForm } from "@desktop/hooks/forms/use-update-preferences-form";
import { useAppVersion } from "@desktop/hooks/queries/use-app-version";
import { Logo } from "@diskpond/components/logo";
import { SOURCE_URL } from "@diskpond/constants/app";
import { LANGUAGE_CODES, LANGUAGE_NAMES } from "@diskpond/constants/language";
import { FormDisabledContext, useStore } from "@diskpond/forms/use-app-form";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { ZInterfaceScale } from "@diskpond/schemas/settings";
import { Button } from "@diskpond/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

export const Route = createFileRoute("/$accountId/settings")({
  component: Settings,
});

function Settings() {
  const { t } = useAppTranslation("workspace.settings");
  const { data: version } = useAppVersion();
  return (
    <div className="flex min-h-full flex-col overflow-y-auto p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-8">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Preferences />
        <PasswordStorageNotice showProtected />
        <SettingsGroup title={t("about.title")}>
          <SettingsPanel>
            <SettingsRow
              title="DiskPond"
              description={
                version ? t("about.version", { version }) : undefined
              }
            >
              <Logo />
            </SettingsRow>
            <SettingsRow fullWidth>
              <p className="text-sm text-muted-foreground">
                {t("about.attribution")}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => window.electron.shell.open.browser(SOURCE_URL)}
                >
                  {t("about.source")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    window.electron.shell.open.browser(`${SOURCE_URL}/issues`)
                  }
                >
                  {t("about.issues")}
                </Button>
              </div>
            </SettingsRow>
          </SettingsPanel>
        </SettingsGroup>
      </div>
    </div>
  );
}

function Preferences() {
  const { t } = useAppTranslation("settings.account.preferences");
  const form = useUpdatePreferencesForm();
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const installed = window.electron.app.isPackaged();

  return (
    <FormDisabledContext.Provider value={submitting}>
      <form
        className="flex min-w-0 flex-col gap-8"
        aria-busy={submitting}
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit(event);
        }}
      >
        <p className="-mt-5 text-sm text-muted-foreground">
          {t("savedAutomatically")}
        </p>
        <SettingsGroup title={t("title")}>
          <SettingsPanel>
            <SettingsRow
              title={t("theme.label")}
              description={t("theme.description")}
            >
              <form.AppField name="theme">
                {(field) => (
                  <field.Select
                    label={{
                      title: t("theme.label"),
                      labelClassName: "sr-only",
                    }}
                    triggerClassName="md:w-44"
                    items={[
                      {
                        value: "light",
                        label: (
                          <span className="flex items-center gap-2">
                            <SunIcon className="size-4" />
                            {t("theme.items.light")}
                          </span>
                        ),
                      },
                      {
                        value: "dark",
                        label: (
                          <span className="flex items-center gap-2">
                            <MoonIcon className="size-4" />
                            {t("theme.items.dark")}
                          </span>
                        ),
                      },
                      {
                        value: "system",
                        label: (
                          <span className="flex items-center gap-2">
                            <MonitorIcon className="size-4" />
                            {t("theme.items.system")}
                          </span>
                        ),
                      },
                    ]}
                  />
                )}
              </form.AppField>
            </SettingsRow>
            <SettingsRow
              title={t("language.label")}
              description={t("language.description")}
            >
              <form.AppField name="language">
                {(field) => (
                  <field.Select
                    label={{
                      title: t("language.label"),
                      labelClassName: "sr-only",
                    }}
                    triggerClassName="md:w-44"
                    items={LANGUAGE_CODES.map((code) => ({
                      value: code,
                      label: LANGUAGE_NAMES[code].name,
                    }))}
                  />
                )}
              </form.AppField>
            </SettingsRow>
            <SettingsRow
              title={t("interfaceScale.label")}
              description={t("interfaceScale.description")}
            >
              <form.AppField name="interfaceScale">
                {(field) => (
                  <field.Select
                    label={{
                      title: t("interfaceScale.label"),
                      labelClassName: "sr-only",
                    }}
                    triggerClassName="md:w-44"
                    items={ZInterfaceScale.options.map((scale) => ({
                      value: scale,
                      label: `${Math.round(Number(scale) * 100)}%`,
                    }))}
                  />
                )}
              </form.AppField>
            </SettingsRow>
            <SettingsRow fullWidth>
              <form.AppField name="reduceMotion">
                {(field) => (
                  <field.Switch
                    label={{
                      title: t("reduceMotion.label"),
                      description: t("reduceMotion.description"),
                    }}
                  />
                )}
              </form.AppField>
            </SettingsRow>
          </SettingsPanel>
        </SettingsGroup>
        <SettingsGroup title={t("startup.title")}>
          <SettingsPanel>
            <SettingsRow fullWidth>
              <form.AppField name="launchAtLogin">
                {(field) => (
                  <field.Switch
                    disabled={!installed}
                    label={{
                      title: t("launchAtLogin.label"),
                      description: t(
                        installed
                          ? "launchAtLogin.description"
                          : "launchAtLogin.unavailable",
                      ),
                    }}
                  />
                )}
              </form.AppField>
            </SettingsRow>
            <SettingsRow fullWidth>
              <form.AppField name="keepRunningInBackground">
                {(field) => (
                  <field.Switch
                    label={{
                      title: t("keepRunningInBackground.label"),
                      description: t("keepRunningInBackground.description"),
                    }}
                  />
                )}
              </form.AppField>
            </SettingsRow>
          </SettingsPanel>
        </SettingsGroup>
        <SettingsGroup title={t("backups.title")}>
          <SettingsPanel>
            <SettingsRow
              title={t("mode.label")}
              description={t("mode.description")}
            >
              <form.AppField name="mode">
                {(field) => (
                  <field.Select
                    label={{
                      title: t("mode.label"),
                      labelClassName: "sr-only",
                    }}
                    triggerClassName="md:w-44"
                    items={[
                      { value: "basic", label: t("mode.items.basic") },
                      { value: "advanced", label: t("mode.items.advanced") },
                    ]}
                  />
                )}
              </form.AppField>
            </SettingsRow>
          </SettingsPanel>
        </SettingsGroup>
        <SettingsGroup title={t("updates.title")}>
          <SettingsPanel>
            <SettingsRow fullWidth>
              <form.AppField name="checkForUpdates">
                {(field) => (
                  <field.Switch
                    label={{
                      title: t("checkForUpdates"),
                      description: t("updates.description"),
                    }}
                  />
                )}
              </form.AppField>
            </SettingsRow>
            <SettingsRow fullWidth>
              <CheckForUpdates />
            </SettingsRow>
          </SettingsPanel>
        </SettingsGroup>
      </form>
    </FormDisabledContext.Provider>
  );
}
