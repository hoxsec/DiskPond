import type { ZHistorySourceIdentityType } from "@blinkdisk/schemas/history";
import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { historyKey, readSnapshotHistory } from "@desktop/lib/history";
import { useQuery } from "@tanstack/react-query";

export function useSnapshotHistory(
  vaultId: string,
  source: ZHistorySourceIdentityType,
) {
  const { queryKeys } = useQueryKey();
  const { running } = useVaultStatus(vaultId);
  return useQuery({
    queryKey: [
      ...queryKeys.backup.all,
      "history",
      ...historyKey(vaultId, source),
    ],
    queryFn: ({ signal }) => readSnapshotHistory(vaultId, source, signal),
    enabled: running,
    staleTime: 30_000,
    retry: false,
  });
}
