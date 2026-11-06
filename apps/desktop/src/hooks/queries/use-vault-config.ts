import { CustomError } from "@blinkdisk/utils/error";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useVaultId } from "@desktop/hooks/use-vault-id";
import { useQuery } from "@tanstack/react-query";

export function useVaultConfig(vaultIdOverride?: string) {
  const { queryKeys } = useQueryKey();
  const { vaultId: routeVaultId } = useVaultId();
  const vaultId = vaultIdOverride ?? routeVaultId;
  return useQuery({
    queryKey: queryKeys.vault.config(vaultId),
    queryFn: () => {
      if (!vaultId) throw new CustomError("MISSING_REQUIRED_VALUE");
      return window.electron.vault.connectionSummary({ vaultId });
    },
    enabled: !!vaultId,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
