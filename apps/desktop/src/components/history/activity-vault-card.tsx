import {
  resolveStorageProviderType,
  type StorageProviderType,
} from "@blinkdisk/constants/providers";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { Skeleton } from "@blinkdisk/ui/skeleton";
import { cn } from "@blinkdisk/utils/class";
import { providerIcons } from "@desktop/components/icons/providers/index";
import {
  type ActivityHistory,
  activitySourceKey,
} from "@desktop/lib/backup-activity";
import { formatHistoryTime } from "@desktop/lib/history";
import { formatInt } from "@desktop/lib/number";
import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  ClockIcon,
  HardDriveIcon,
} from "lucide-react";

export function ActivityVaultCard({
  vault,
  query,
  selected,
  onSelect,
}: {
  vault: { id: string; name: string; provider?: StorageProviderType };
  query: {
    data?: ActivityHistory;
    isError: boolean;
    isPending: boolean;
    isFetching: boolean;
    refetch: () => unknown;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, language } = useAppTranslation("history");
  const Icon = vault.provider
    ? providerIcons[resolveStorageProviderType(vault.provider)]
    : HardDriveIcon;
  const history = !query.isError ? query.data : undefined;
  const latest = history?.records.at(-1)?.snapshot.endTime;
  const partial = !!history?.limited || !!history?.unavailableSources.length;
  const timestamp = latest
    ? new Date(latest).toLocaleString(language, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...(new Date(latest).getFullYear() !== new Date().getFullYear()
          ? { year: "numeric" as const }
          : {}),
      })
    : undefined;

  return (
    <li
      data-slot="activity-vault"
      className={cn(
        "flex min-w-0 flex-col border bg-card",
        selected && "border-primary",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="group flex min-w-0 flex-1 flex-col p-5 text-left outline-none hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex w-full items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center border bg-muted">
            <Icon aria-hidden="true" className="size-4" />
          </span>
          <span
            className="min-w-0 flex-1 truncate font-medium"
            title={vault.name}
          >
            {vault.name}
          </span>
          <ArrowUpRightIcon
            className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
            aria-hidden="true"
          />
        </span>
        <span className="mt-5 flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {query.isPending ? (
              <Skeleton width={60} />
            ) : history ? (
              formatInt(history.records.length, language)
            ) : (
              "—"
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("calendar.snapshots")}
          </span>
        </span>
        <span
          className={cn(
            "mt-3 flex items-start gap-1.5 text-xs leading-relaxed",
            query.isError || partial ? "text-warning" : "text-muted-foreground",
          )}
        >
          {query.isError || partial ? (
            <AlertTriangleIcon
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
          ) : (
            <ClockIcon
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
          )}
          <span>
            {query.isError ? (
              t("calendar.offline")
            ) : query.isPending ? (
              t("loading")
            ) : partial ? (
              t("calendar.incompleteCoverage")
            ) : latest ? (
              <>
                {t("calendar.lastBackup")}{" "}
                <time
                  dateTime={latest}
                  title={formatHistoryTime(latest, language)}
                >
                  {timestamp}
                </time>
              </>
            ) : (
              t("calendar.noBackups")
            )}
          </span>
        </span>
      </button>
      {query.isError ? (
        <div className="border-t px-5 py-3">
          <Button
            variant="secondary"
            size="sm"
            loading={query.isFetching}
            onClick={() => query.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}
      {partial && history ? (
        <div className="space-y-2 border-t px-5 py-3 text-xs text-warning">
          {history.unavailableSources.length ? (
            <details>
              <summary className="cursor-pointer py-1">
                {t("calendar.missingSources", {
                  count: history.unavailableSources.length,
                })}
              </summary>
              <ul className="mt-2 space-y-1">
                {history.unavailableSources.map((source) => (
                  <li
                    key={activitySourceKey(source)}
                    className="break-all font-mono"
                  >
                    {source.userName}@{source.host}:{source.path}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {history.limited ? <p>{t("calendar.limited")}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
