import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type { ZVaultType } from "@blinkdisk/schemas/vault";
import { VaultStatCard } from "@desktop/components/vaults/stat-card";
import { useAccountStats } from "@desktop/hooks/queries/use-account-stats";
import { formatInt, formatSize } from "@desktop/lib/number";
import {
  FilesIcon,
  HardDriveIcon,
  LayersIcon,
  Minimize2Icon,
} from "lucide-react";

export function AccountOverviewCards({ vaults }: { vaults?: ZVaultType[] }) {
  const { t, language } = useAppTranslation("vault.overview");
  const stats = useAccountStats(vaults);
  const unavailable = stats.total > 0 && stats.available === 0;
  const coverage = (available: number, description: string) =>
    available < stats.total
      ? t("global.coverage", { available, total: stats.total })
      : description;
  return (
    <section
      aria-label={t("global.title")}
      className="mb-8 grid grid-cols-1 gap-4 @sm:grid-cols-2 @3xl:grid-cols-4"
    >
      <VaultStatCard
        title={t("stats.totalSize")}
        value={
          unavailable
            ? t("stats.unavailable")
            : formatSize(stats.protectedBytes, { locale: language })
        }
        tooltip={coverage(stats.available, t("global.latestCopies"))}
        icon={<HardDriveIcon />}
        isLoading={stats.isLoading}
      />
      <VaultStatCard
        title={t("stats.files")}
        value={
          unavailable
            ? t("stats.unavailable")
            : formatInt(stats.protectedFiles, language)
        }
        tooltip={coverage(stats.available, t("global.latestCopies"))}
        icon={<FilesIcon />}
        isLoading={stats.isLoading}
      />
      <VaultStatCard
        title={t("global.snapshots")}
        value={
          unavailable
            ? t("stats.unavailable")
            : formatInt(stats.snapshots, language)
        }
        tooltip={coverage(stats.available, t("global.retained"))}
        icon={<LayersIcon />}
        isLoading={stats.isLoading}
      />
      <VaultStatCard
        title={t("global.saved")}
        value={
          stats.total > 0 && stats.savingsAvailable === 0
            ? t("stats.unavailable")
            : formatSize(stats.savedBytes, { locale: language })
        }
        tooltip={`${coverage(stats.savingsAvailable, t("global.savingsDescription"))}. ${t("global.savingsExplanation")}`}
        icon={<Minimize2Icon />}
        isLoading={stats.isLoading}
      />
    </section>
  );
}
