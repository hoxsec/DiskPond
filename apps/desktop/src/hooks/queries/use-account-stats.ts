import type { ZVaultType } from "@blinkdisk/schemas/vault";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import {
  summarizeAccountStats,
  ZRepositoryStats,
} from "@desktop/lib/account-stats";
import { vaultApi } from "@desktop/lib/vault";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";

function repositoryStatsOptions(key: readonly unknown[], vaultId: string) {
  return queryOptions({
    queryKey: [...key, "overview", vaultId],
    queryFn: async ({ signal }) => {
      const status = await window.electron.vault.status(vaultId);
      if (status?.status !== "RUNNING") return null;
      const { data } = await vaultApi(vaultId).get("/api/v1/repo/stats", {
        signal,
        timeoutMs: 35_000,
      });
      return ZRepositoryStats.parse(data);
    },
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data === null
        ? 2_000
        : query.state.status === "error"
          ? 10_000
          : 60_000,
    retry: false,
  });
}

export function useVaultStats(vaultId: string) {
  const { queryKeys } = useQueryKey();
  return useQuery(repositoryStatsOptions(queryKeys.backup.all, vaultId));
}

export function useAccountStats(vaults?: ZVaultType[]) {
  const { queryKeys } = useQueryKey();
  // Two connections to the same repository are not two copies of its data.
  const repositories = Array.from(
    new Map(
      (vaults ?? []).map((vault) => [vault.coreId || vault.id, vault]),
    ).values(),
  );
  const queries = useQueries({
    queries: repositories.map((vault) =>
      repositoryStatsOptions(queryKeys.backup.all, vault.id),
    ),
  });
  return {
    ...summarizeAccountStats(queries),
    isLoading: vaults === undefined || queries.some((query) => query.isPending),
  };
}
