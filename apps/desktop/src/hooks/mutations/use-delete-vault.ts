import { useAccountId } from "@desktop/hooks/use-account-id";
import { getVaultCollection } from "@desktop/lib/db";
import { CustomError } from "@diskpond/utils/error";
import { showErrorToast } from "@diskpond/utils/error-toast";
import { useMutation } from "@tanstack/react-query";

export function useDeleteVault({ onSuccess }: { onSuccess?: () => void }) {
  const { accountId } = useAccountId();

  return useMutation({
    mutationKey: ["vault", "delete"],
    mutationFn: async ({ vaultId }: { vaultId: string }) => {
      const vault = getVaultCollection(accountId).findOne({ id: vaultId });
      if (!vault) throw new CustomError("VAULT_NOT_FOUND");

      getVaultCollection(accountId).updateOne(
        {
          id: vaultId,
        },
        {
          $set: {
            status: "DELETED",
          },
        },
      );
    },
    onError: showErrorToast,
    onSuccess,
  });
}
