import { getStorageProvider } from "@blinkdisk/constants/providers";
import { sourceTypeFromKopiaEntryType } from "@blinkdisk/schemas/source";
import type { ZVaultType } from "@blinkdisk/schemas/vault";
import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import { getBackupIssue } from "@desktop/lib/backup-issue";

type HealthQuery = {
  data?: Pick<
    ReturnType<typeof inspectBackupHealth>,
    "sourcesWithIssues" | "sourceCount" | "freshSources"
  > | null;
  isPending: boolean;
  isError: boolean;
};

export function inspectBackupHealth(
  sources: CoreSourceItem[],
  now = Date.now(),
) {
  const latestBackup = sources.reduce((latest, source) => {
    const timestamp = Date.parse(source.lastSnapshot?.endTime ?? "");
    return Number.isFinite(timestamp) && timestamp > latest
      ? timestamp
      : latest;
  }, 0);
  return {
    latestBackup: latestBackup ? new Date(latestBackup).toISOString() : null,
    folderCount: sources.filter(
      (source) =>
        (source.type ||
          sourceTypeFromKopiaEntryType(source.lastSnapshot?.rootEntry?.type) ||
          source.initialSourceType) === "directory",
    ).length,
    uploading: sources.some((source) => source.status === "UPLOADING"),
    pending: sources.some((source) => source.status === "PENDING"),
    sourcesWithIssues: sources.filter((source) => getBackupIssue(source))
      .length,
    sourceCount: sources.length,
    freshSources: sources.filter((source) => {
      const snapshot = source.lastSnapshot;
      const age = now - Date.parse(snapshot?.endTime ?? "");
      return (
        !!snapshot &&
        !snapshot.incomplete &&
        !getBackupIssue(source) &&
        age >= 0 &&
        age <= 24 * 60 * 60 * 1000
      );
    }).length,
  };
}

export function summarizeBackupHealth(queries: HealthQuery[]) {
  return {
    sourcesWithIssues: queries.reduce(
      (count, query) => count + (query.data?.sourcesWithIssues ?? 0),
      0,
    ),
    isLoading: queries.some((query) => query.isPending),
    isUnavailable: queries.some(
      (query) => query.isError || query.data === null,
    ),
    allFresh:
      queries.length > 0 &&
      queries.every(
        (query) =>
          !query.isPending &&
          !query.isError &&
          !!query.data?.sourceCount &&
          query.data.freshSources === query.data.sourceCount,
      ),
  };
}

export function scoreBackupSetup(
  vaults: Pick<ZVaultType, "id" | "coreId" | "provider">[],
  health: ReturnType<typeof summarizeBackupHealth>,
) {
  const repositories = Array.from(
    new Map(vaults.map((vault) => [vault.coreId || vault.id, vault])).values(),
  );
  const providers = repositories.map((vault) =>
    getStorageProvider(vault.provider),
  );
  const types = new Set(
    providers.flatMap((provider) =>
      provider ? [provider.local ? provider.type : provider.coreType] : [],
    ),
  );
  const checks = [
    { key: "destinations", passed: repositories.length >= 2 },
    { key: "variety", passed: types.size >= 2 },
    {
      key: "remote",
      passed: providers.some((provider) => provider && !provider.local),
    },
    {
      key: "freshness",
      passed: health.isUnavailable || health.isLoading ? null : health.allFresh,
    },
  ] as const;
  return { checks, score: checks.filter((check) => check.passed).length * 25 };
}
