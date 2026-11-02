import type { StorageProviderType } from "@blinkdisk/constants/providers";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import { useAccountId } from "@desktop/hooks/use-account-id";
import { getVaultCollection } from "@desktop/lib/db";
import { getMissingRcloneRemote } from "@desktop/lib/rclone-validation";
import { useCallback } from "react";

export type VaultAction = "CREATE" | "SETUP" | "UPDATE";

export function useConfigValidation(
  providerType: StorageProviderType,
  action: VaultAction,
) {
  const { accountId } = useAccountId();
  const { t } = useAppTranslation("vault.createDialog.config.validationError");

  const onSubmitAsync = useCallback(
    async ({ value }: { value: object }) => {
      // Validation for connect is done elsewhere
      if (action === "SETUP") return;

      // Can't update config at the moment
      if (action === "UPDATE") return { code: "READ_ONLY" };

      const result = await window.electron.vault.validate({
        type: providerType,
        config: value as ProviderConfig,
      });

      if (result.code === "NOT_INITIALIZED") return;

      if (result.error) {
        const missingRemote =
          providerType === "RCLONE"
            ? getMissingRcloneRemote(
                result.error,
                (value as { remotePath: string }).remotePath,
              )
            : undefined;

        return {
          code: "VAULT_VALIDATION_FAILED",
          message: missingRemote
            ? t("rcloneRemoteNotConfigured", { remote: missingRemote })
            : result.code
              ? `[${result.code}] ${result.error}`
              : result.error,
        };
      }

      const storedId = atob(result.uniqueID || "");

      const vaults = getVaultCollection(accountId).find().fetch();

      const existing = vaults.find(
        (v) => v.coreId === storedId && v.status === "ACTIVE",
      );
      if (existing)
        return {
          code: "VAULT_ALREADY_EXISTS",
          name: existing.name,
        };
    },
    [action, providerType, accountId, t],
  );

  return { onSubmitAsync };
}
