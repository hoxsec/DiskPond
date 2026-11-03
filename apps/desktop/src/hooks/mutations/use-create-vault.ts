import { getStorageProvider } from "@blinkdisk/constants/providers";
import {
  DEFAULT_VAULT_OPTIONS,
  LATEST_VAULT_VERSION,
} from "@blinkdisk/constants/vault";
import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import type { ZCreateVaultType } from "@blinkdisk/schemas/vault";
import { CustomError } from "@blinkdisk/utils/error";
import { showErrorToast } from "@blinkdisk/utils/error-toast";
import { generateId } from "@blinkdisk/utils/id";
import { tryCatch } from "@blinkdisk/utils/try-catch";
import { useAccountId } from "@desktop/hooks/use-account-id";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { getVaultCollection } from "@desktop/lib/db";
import { convertPolicyToCore, defaultVaultPolicy } from "@desktop/lib/policy";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type CreateVaultResponse = {
  vaultId: string;
};

export function useCreateVault(onSuccess: (res: CreateVaultResponse) => void) {
  const queryClient = useQueryClient();

  const { accountId } = useAccountId();
  const { queryKeys } = useQueryKey();

  return useMutation({
    mutationKey: ["vault", "create"],
    mutationFn: async (
      values: Pick<ZCreateVaultType, "name" | "provider"> & {
        password: string;
        config: ProviderConfig;
      },
    ) => {
      const provider = getStorageProvider(values.provider);

      if (!provider || provider.type === "CLOUDBLINK")
        throw new Error("Invalid provider");

      let initialised = false;
      let coreId: string | undefined;
      {
        const validation = await window.electron.vault.validate({
          type: provider.type,
          config: values.config,
          password: values.password,
        });

        if (validation.code === "INVALID_PASSWORD")
          throw { code: "INVALID_PASSWORD" };
        if (
          (validation.code || validation.error) &&
          validation.code !== "NOT_INITIALIZED"
        )
          throw new CustomError("STORAGE_UNREACHABLE");

        initialised = !!validation.uniqueID;
        if (validation.uniqueID) coreId = atob(validation.uniqueID);
      }

      const vaultId = generateId("Vault");

      if (!initialised) {
        const [res, error] = await tryCatch(
          window.electron.vault.create({
            vault: {
              id: vaultId,
              name: values.name,
              provider: provider.type,
              config: values.config,
              options: DEFAULT_VAULT_OPTIONS,
              password: values.password,
            },
            userPolicy: {},
            globalPolicy: convertPolicyToCore(defaultVaultPolicy),
          }),
        );

        if (error || res.error || res.code) {
          throw error || new Error(res.error?.toString());
        }
      } else {
        // Vault already exists, connect to it.
        const [res, error] = await tryCatch(
          window.electron.vault.connect({
            id: vaultId,
            name: values.name,
            provider: provider.type,
            config: values.config,
            password: values.password,
          }),
        );

        if (error || res.error || res.code)
          throw error || new Error(res.error?.toString());
      }

      getVaultCollection(accountId).insert({
        id: vaultId,
        name: values.name,
        provider: provider.type,
        coreId: coreId || vaultId,
        configLevel: provider.level,
        status: "ACTIVE",
        options: DEFAULT_VAULT_OPTIONS,
        version: LATEST_VAULT_VERSION,
        createdAt: new Date().toISOString(),
      });

      await window.electron.vault.password.set({
        vaultId,
        password: values.password,
      });

      return { vaultId };
    },
    onError: showErrorToast,
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.vault.status(res.vaultId),
      });

      onSuccess?.(res);
    },
  });
}
