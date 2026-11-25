import { useAccountId } from "@desktop/hooks/use-account-id";
import { getVaultCollection } from "@desktop/lib/db";
import { CustomError } from "@diskpond/utils/error";
import { showErrorToast } from "@diskpond/utils/error-toast";
import { useMutation } from "@tanstack/react-query";

export function useDeleteVault({ onSuccess }: { onSuccess?: () => void }) {
  const { accountId } = useAccountId();

  return useMutation({
    mutationKey: ["vault", "delete"],
    networkMode: "always",
    mutationFn: async ({ vaultId }: { vaultId: string }) => {
      const updated = getVaultCollection(accountId).updateOne(
        { id: vaultId, status: "ACTIVE" },
        { $set: { status: "DELETED" } },
      );
      if (!updated) throw new CustomError("VAULT_NOT_FOUND");
    },
    onError: showErrorToast,
    onSuccess,
  });
}
