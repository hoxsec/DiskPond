import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import { CustomError } from "@blinkdisk/utils/error";
import { showErrorToast } from "@blinkdisk/utils/error-toast";
import type { SetupStep } from "@desktop/components/vaults/setup";
import type { VaultItem } from "@desktop/hooks/queries/use-vault";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSetupVault({
  onSuccess,
  setStep,
}: {
  onSuccess?: () => void;
  setStep: (to: SetupStep) => void;
}) {
  const queryClient = useQueryClient();
  const { queryKeys } = useQueryKey();
  return useMutation({
    mutationKey: ["vault", "setup"],
    mutationFn: async (values: {
      vault: VaultItem;
      password: string;
      config: ProviderConfig | null;
    }) => {
      const result = await window.electron.vault.unlock({
        vaultId: values.vault.id,
        password: values.password,
        config: values.config,
      });
      if (result.code === "CONNECTION_REQUIRED") {
        setStep("CONFIG");
        return false;
      }
      if (result.code === "INVALID_PASSWORD") {
        setStep("PASSWORD");
        throw new CustomError("INVALID_PASSWORD");
      }
      if (result.code === "INCORRECT_VAULT") {
        setStep("CONFIG");
        throw new CustomError("INCORRECT_VAULT");
      }
      if (result.code) {
        setStep("CONFIG");
        throw new CustomError("INCORRECT_CONFIG");
      }
      return true;
    },
    onError: showErrorToast,
    onSuccess: async (connected, values) => {
      if (!connected) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.vault.status(values.vault.id),
      });
      onSuccess?.();
    },
  });
}
