import {
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
} from "@desktop/components/settings";
import { DisconnectVaultButton } from "@desktop/components/vaults/disconnect-button";
import { useUpdateVaultForm } from "@desktop/hooks/forms/use-update-vault-form";
import { useVaultId } from "@desktop/hooks/use-vault-id";
import { FormDisabledContext, useStore } from "@diskpond/forms/use-app-form";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { useContext } from "react";
import { VaultConfigSettings } from "./config";
import { VaultThrottleSettings } from "./throttle";

export function VaultGeneralSettings() {
  const { t } = useAppTranslation("settings.vault.general");
  const { vaultId } = useVaultId();

  const form = useUpdateVaultForm();
  const [isDirty, isSubmitting] = useStore(form.store, (state) => [
    state.isDirty,
    state.isSubmitting,
  ]);
  const disabled = useContext(FormDisabledContext);

  const submitIfNeeded = () => {
    if (!isDirty || isSubmitting) return;

    form.handleSubmit();
  };

  return (
    <>
      <SettingsGroup title={t("title")}>
        <SettingsPanel>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              submitIfNeeded();
            }}
            onBlur={(e) => {
              if (!(e.target instanceof HTMLInputElement)) return;
              if (e.target.name !== "name") return;

              submitIfNeeded();
            }}
          >
            <SettingsRow title={t("name.label")} description={t("description")}>
              <form.AppField name="name">
                {(field) => (
                  <field.Text
                    label={{
                      title: t("name.label"),
                      labelClassName: "sr-only",
                      required: true,
                    }}
                    placeholder={t("name.placeholder")}
                    className="md:w-64"
                  />
                )}
              </form.AppField>
            </SettingsRow>
          </form>
          <SettingsRow
            title={t("delete.title")}
            description={t("delete.description")}
          >
            <DisconnectVaultButton vaultId={vaultId} disabled={disabled} />
          </SettingsRow>
        </SettingsPanel>
      </SettingsGroup>
      <VaultThrottleSettings />
      <VaultConfigSettings />
    </>
  );
}
