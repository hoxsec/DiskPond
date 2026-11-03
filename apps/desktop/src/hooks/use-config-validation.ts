import type { StorageProviderType } from "@blinkdisk/constants/providers";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import { useAccountId } from "@desktop/hooks/use-account-id";
import { getVaultCollection } from "@desktop/lib/db";
import { getMissingRcloneRemote } from "@desktop/lib/rclone-validation";
import { connectionErrorKey } from "@desktop/lib/vault-connection";
import { createContext, useCallback, useContext } from "react";

export type VaultAction = "CREATE" | "CONNECT" | "SETUP" | "UPDATE";
export const VaultValidationPending = createContext<(pending: boolean) => void>(
  () => {},
);

export function useConfigValidation(
  providerType: StorageProviderType,
  action: VaultAction,
) {
  const { accountId } = useAccountId();
  const setPending = useContext(VaultValidationPending);
  const { t } = useAppTranslation("vault.createDialog.config.validationError");
  const { t: vaultText } = useAppTranslation("vault");

  const validate = useCallback(
    async ({ value }: { value: object }) => {
      // Validation for connect is done elsewhere
      if (action === "SETUP") return;

      // Can't update config at the moment
      if (action === "UPDATE") return { code: "READ_ONLY" };

      let result: Awaited<ReturnType<typeof window.electron.vault.validate>>;
      try {
        result = await window.electron.vault.validate({
          type: providerType,
          config: value as ProviderConfig,
          intent: action,
        });
      } catch {
        return {
          code: "VAULT_VALIDATION_FAILED",
          message: vaultText("connectionErrors.unavailable"),
        };
      }

      if (action === "CREATE" && result.code === "NOT_INITIALIZED") return;

      if (result.code || result.error) {
        const missingRemote =
          providerType === "RCLONE"
            ? getMissingRcloneRemote(
                result.error || "",
                (value as { remotePath: string }).remotePath,
              )
            : undefined;

        return {
          code: "VAULT_VALIDATION_FAILED",
          message: missingRemote
            ? t("rcloneRemoteNotConfigured", { remote: missingRemote })
            : vaultText(`connectionErrors.${connectionErrorKey(result.code)}`),
        };
      }

      if (!result.uniqueID)
        return {
          code: "VAULT_VALIDATION_FAILED",
          message: vaultText("connectionErrors.invalid"),
        };
      const storedId = atob(result.uniqueID);

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
    [action, providerType, accountId, t, vaultText],
  );

  const onSubmitAsync = useCallback(
    async (input: { value: object }) => {
      setPending(true);
      try {
        return await validate(input);
      } finally {
        setPending(false);
      }
    },
    [validate, setPending],
  );

  return { onSubmitAsync };
}
