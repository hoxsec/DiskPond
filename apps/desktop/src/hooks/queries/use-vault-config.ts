import { CustomError } from "@blinkdisk/utils/error";
import { useVault } from "@desktop/hooks/queries/use-vault";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useQuery } from "@tanstack/react-query";

export function useVaultConfig() {
  const { queryKeys } = useQueryKey();
  const { data: vault } = useVault();
  return useQuery({
    queryKey: queryKeys.vault.config(vault?.id),
    queryFn: () => {
      if (!vault) throw new CustomError("MISSING_REQUIRED_VALUE");
      return window.electron.vault.connectionSummary({ vaultId: vault.id });
    },
    enabled: !!vault,
  });
}
