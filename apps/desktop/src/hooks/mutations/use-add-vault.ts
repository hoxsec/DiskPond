import { useAccountId } from "@desktop/hooks/use-account-id";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { getVaultCollection } from "@desktop/lib/db";
import { convertPolicyToCore, defaultVaultPolicy } from "@desktop/lib/policy";
import { getStorageProvider } from "@diskpond/constants/providers";
import {
  DEFAULT_VAULT_OPTIONS,
  LATEST_VAULT_VERSION,
} from "@diskpond/constants/vault";
import type { ProviderConfig } from "@diskpond/schemas/providers";
import type { ZCreateVaultType } from "@diskpond/schemas/vault";
import { CoreError } from "@diskpond/utils/error";
import { generateId } from "@diskpond/utils/id";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type CreateVaultResponse = {
  vaultId: string;
};

export function useAddVault(
  intent: "CREATE" | "CONNECT",
  onSuccess: (res: CreateVaultResponse) => void,
) {
  const queryClient = useQueryClient();

  const { accountId } = useAccountId();
  const { queryKeys } = useQueryKey();

  return useMutation({
    mutationKey: ["vault", intent],
    mutationFn: async (
      values: Pick<ZCreateVaultType, "name" | "provider"> & {
        password: string;
        config: ProviderConfig;
      },
    ) => {
      const provider = getStorageProvider(values.provider);

      if (!provider || provider.type === "CLOUDBLINK")
        throw new Error("Invalid provider");

      const vaultId = generateId("Vault");
      // Each entry point invokes exactly its named native operation. Main
      // rechecks the destination and identity before any repository writes.
      const result =
        intent === "CREATE"
          ? await window.electron.vault.create({
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
            })
          : await window.electron.vault.connect({
              id: vaultId,
              name: values.name,
              provider: provider.type,
              config: values.config,
              password: values.password,
            });
      if (result.code || result.error || !result.coreId)
        throw new CoreError({
          code: result.code || "CONNECTION_FAILED",
          message: result.error || "",
        });

      getVaultCollection(accountId).insert({
        id: vaultId,
        name: values.name,
        provider: provider.type,
        coreId: result.coreId,
        configLevel: provider.level,
        status: "ACTIVE",
        options: DEFAULT_VAULT_OPTIONS,
        version: LATEST_VAULT_VERSION,
        createdAt: new Date().toISOString(),
      });

      return { vaultId };
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.vault.status(res.vaultId),
      });

      onSuccess?.(res);
    },
  });
}
