import type { ZVaultType } from "@blinkdisk/schemas/vault";
import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import {
  inspectBackupHealth,
  summarizeBackupHealth,
} from "@desktop/lib/backup-health";
import { isDraftPolicyUserName } from "@desktop/lib/policy-target";
import { vaultApi } from "@desktop/lib/vault";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";

function backupHealthOptions(key: readonly unknown[], vaultId: string) {
  return queryOptions({
    queryKey: [...key, "health", vaultId],
    queryFn: async ({ signal }) => {
      const status = await window.electron.vault.status(vaultId);
      if (status?.status !== "RUNNING") return null;
      const res = await vaultApi(vaultId).get<{ sources: CoreSourceItem[] }>(
        "/api/v1/sources",
        { signal, timeoutMs: 15_000 },
      );
      return inspectBackupHealth(
        res.data.sources.filter(
          (source) => !isDraftPolicyUserName(source.source.userName),
        ),
      );
    },
    staleTime: 1_000,
    refetchInterval: 2_000,
    retry: false,
  });
}

export function useVaultHealth(vaultId: string) {
  const { queryKeys } = useQueryKey();
  return useQuery(backupHealthOptions(queryKeys.source.all, vaultId));
}

export function useBackupHealth(vaults?: ZVaultType[]) {
  const { queryKeys } = useQueryKey();
  const queries = useQueries({
    queries: (vaults || []).map((vault) =>
      backupHealthOptions(queryKeys.source.all, vault.id),
    ),
  });

  return summarizeBackupHealth(queries);
}
