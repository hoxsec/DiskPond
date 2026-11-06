import { backupHealthOptions } from "@desktop/hooks/queries/use-backup-health";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { readSnapshotHistory, snapshotOutcome } from "@desktop/lib/history";
import {
  latestSourceSuccess,
  type ProtectionVault,
  summarizeProtection,
} from "@desktop/lib/protection-status";
import type { ZVaultType } from "@diskpond/schemas/vault";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useProtectionStatus(vaults?: ZVaultType[]) {
  const { queryKeys } = useQueryKey();
  const [, tick] = useState(0);
  const now = Date.now();
  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const connections = useQueries({
    queries: (vaults ?? []).map((vault) => ({
      queryKey: queryKeys.vault.status(vault.id),
      queryFn: () => window.electron.vault.status(vault.id),
      refetchInterval: 1000,
      retry: false,
    })),
  });
  const health = useQueries({
    queries: (vaults ?? []).map((vault) =>
      backupHealthOptions(queryKeys.source.all, vault.id),
    ),
  });
  const checked: ProtectionVault[] = (vaults ?? []).map((vault, index) => {
    const connection = connections[index];
    const query = health[index];
    const status = connection?.data?.status;
    return {
      id: vault.id,
      name: vault.name,
      status,
      pending:
        !!connection?.isPending || (status === "RUNNING" && !!query?.isPending),
      unavailable:
        !!connection?.isError ||
        (!connection?.isPending && (!status || status === "FAILED")) ||
        (status === "RUNNING" && (!!query?.isError || query?.data === null)),
      sources: query?.data?.sources ?? [],
    };
  });
  const missingSuccess = checked.flatMap((vault) =>
    vault.status === "RUNNING" && !vault.unavailable
      ? vault.sources
          .filter(
            (source) =>
              source.lastSnapshot && !latestSourceSuccess(source, now),
          )
          .map((source) => ({ vaultId: vault.id, source }))
      : [],
  );
  // Only inspect older versions when the latest snapshot cannot supply a
  // successful time. Cache by result identity, rather than rereading history
  // on every two-second status refresh.
  const history = useQueries({
    queries: missingSuccess.map(({ vaultId, source }) => ({
      queryKey: [
        ...queryKeys.backup.all,
        "protection-success",
        vaultId,
        source.id,
        source.lastSnapshot?.id,
        source.lastBackupOutcome?.id,
      ],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const snapshots = await readSnapshotHistory(
          vaultId,
          source.source,
          signal,
        );
        return snapshots.reduce((latest, snapshot) => {
          const time = Date.parse(snapshot.endTime);
          return snapshotOutcome(snapshot) === "completed" && time <= Date.now()
            ? Math.max(latest, time)
            : latest;
        }, 0);
      },
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    })),
  });
  const model = summarizeProtection(checked, now);

  return {
    ...model,
    state: vaults === undefined ? ("checking" as const) : model.state,
    lastSuccess: Math.max(
      model.lastSuccess,
      ...history.map((query) => (!query.isError ? (query.data ?? 0) : 0)),
    ),
    historyPending: history.some((query) => query.isPending),
    historyUnavailable: history.some((query) => query.isError),
    async refetch() {
      await Promise.all([
        ...connections.map((query) => query.refetch({ throwOnError: true })),
        ...health.map((query) => query.refetch({ throwOnError: true })),
        ...history.map((query) => query.refetch({ throwOnError: true })),
      ]);
    },
  };
}
