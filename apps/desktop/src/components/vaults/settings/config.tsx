import { resolveStorageProviderType } from "@blinkdisk/constants/providers";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { providerIcons } from "@desktop/components/icons/providers";
import {
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
} from "@desktop/components/settings";
import { useVault } from "@desktop/hooks/queries/use-vault";
import { useVaultConfig } from "@desktop/hooks/queries/use-vault-config";

export function VaultConfigSettings() {
  const { t } = useAppTranslation("settings.vault.config");
  const { t: tVault } = useAppTranslation("vault");

  const { data: vault } = useVault();
  const { data: config, isPending, isError } = useVaultConfig();
  const displayProviderType = vault
    ? resolveStorageProviderType(vault.provider)
    : null;
  const Icon = displayProviderType ? providerIcons[displayProviderType] : null;

  if (!vault || vault.provider === "CLOUDBLINK") return null;
  return (
    <SettingsGroup title={t("title")}>
      <SettingsPanel>
        <SettingsRow fullWidth>
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg border">
              {Icon ? <Icon className="size-5" /> : null}
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">{t("provider")}</p>
              <p className="truncate text-base font-medium">
                {displayProviderType
                  ? tVault(`providers.${displayProviderType}.name`)
                  : null}
              </p>
            </div>
          </div>
        </SettingsRow>
        <SettingsRow fullWidth>
          {isPending || isError || !config ? (
            <p role="status" className="text-muted-foreground text-sm">
              {t(isPending ? "loading" : "unavailable")}
            </p>
          ) : (
            <div className="space-y-4">
              <dl className="space-y-3">
                {config.fields.map(({ key, value }) => (
                  <div key={key}>
                    <dt className="text-muted-foreground text-xs">
                      {t(`fields.${key}`)}
                    </dt>
                    <dd className="break-all text-sm">
                      {typeof value === "boolean"
                        ? t(value ? "enabled" : "disabled")
                        : value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-muted-foreground text-sm">
                {t("credentialsHidden")}
              </p>
            </div>
          )}
        </SettingsRow>
      </SettingsPanel>
    </SettingsGroup>
  );
}
