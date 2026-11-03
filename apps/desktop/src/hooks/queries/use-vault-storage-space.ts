import { ZVaultStorageSpace } from "@blinkdisk/schemas/storage";
import { CustomError } from "@blinkdisk/utils/error";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useQuery } from "@tanstack/react-query";

export function useVaultStorageSpace(vaultId?: string) {
  const { queryKeys } = useQueryKey();

  return useQuery({
    queryKey: queryKeys.vault.storageSpace(vaultId),
    queryFn: async () => {
      if (!vaultId) throw new CustomError("MISSING_REQUIRED_VALUE");
      return ZVaultStorageSpace.parse(
        await window.electron.vault.storageSpace({ vaultId }),
      );
    },
    enabled: !!vaultId,
    networkMode: "always",
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
}
