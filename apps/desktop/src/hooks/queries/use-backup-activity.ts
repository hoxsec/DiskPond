import { useQueryKey } from "@desktop/hooks/use-query-key";
import { readActivityHistory } from "@desktop/lib/backup-activity";
import { useQueries } from "@tanstack/react-query";

export function useBackupActivity(vaultIds: string[]) {
  const { queryKeys } = useQueryKey();
  return useQueries({
    queries: vaultIds.map((vaultId) => ({
      queryKey: [...queryKeys.backup.all, "activity", vaultId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readActivityHistory(vaultId, signal),
      staleTime: 60_000,
      refetchInterval: 60_000,
      retry: false,
    })),
  });
}
