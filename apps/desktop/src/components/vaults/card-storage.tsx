import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Skeleton } from "@blinkdisk/ui/skeleton";
import { useVaultStats } from "@desktop/hooks/queries/use-account-stats";
import { useVaultStorageSpace } from "@desktop/hooks/queries/use-vault-storage-space";
import { formatSize } from "@desktop/lib/number";

export function VaultCardStorage({
  vaultId,
  running,
}: {
  vaultId: string;
  running: boolean;
}) {
  const { t, language } = useAppTranslation("vault.card");
  const storage = useVaultStorageSpace(running ? vaultId : undefined);
  const stats = useVaultStats(vaultId);
  const space = running && !storage.isError ? storage.data : undefined;
  const packed =
    running && !stats.isError ? stats.data?.packedBytes : undefined;
  const measured = space?.status === "AVAILABLE" || space?.status === "QUOTA";
  const total = measured ? space.totalBytes : undefined;
  const used =
    measured || space?.status === "NO_QUOTA" ? space.usedBytes : undefined;
  const percent =
    total !== undefined && total > 0 && used !== undefined
      ? Math.min(100, (used / total) * 100)
      : undefined;
  const size = (bytes: number) => formatSize(bytes, { locale: language });
  const loading = running && storage.isPending;
  const value =
    used !== undefined
      ? t("used", { size: size(used) })
      : measured
        ? t("available", { size: size(space.availableBytes) })
        : packed != null
          ? t("stored", { size: size(packed) })
          : "—";
  const capacity =
    total !== undefined
      ? t("capacity", { size: size(total) })
      : space?.status === "NO_QUOTA"
        ? t("noQuota")
        : space?.status === "UNSUPPORTED"
          ? t("capacityUnknown")
          : t("storageUnavailable");
  const detail =
    used !== undefined || measured
      ? t("destinationUsage")
      : t("estimatedUsage");

  return (
    <div className="mt-5" data-slot="vault-card-storage">
      <div
        className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground"
        title={detail}
      >
        <span className="font-medium text-foreground">
          {loading ||
          (running && !measured && used === undefined && stats.isPending) ? (
            <Skeleton width={80} />
          ) : (
            value
          )}
        </span>
        <span>
          {loading ? (
            <Skeleton width={85} />
          ) : measured && total === undefined ? (
            t("capacityUnknown")
          ) : (
            capacity
          )}
        </span>
      </div>
      {percent !== undefined ? (
        <meter
          className="sr-only"
          min={0}
          max={100}
          value={percent}
          aria-label={t("storageLabel")}
          aria-valuetext={`${value}, ${capacity}. ${detail}`}
        />
      ) : null}
      <div aria-hidden="true" className="mt-2.5 h-1.5 overflow-hidden bg-muted">
        {percent !== undefined ? (
          <div
            className="h-full bg-(--vault-color) transition-[width]"
            style={{ width: `${percent}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
