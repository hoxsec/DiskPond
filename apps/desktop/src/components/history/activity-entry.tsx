import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type {
  ZHistorySnapshotType,
  ZHistorySourceIdentityType,
} from "@blinkdisk/schemas/history";
import { Button } from "@blinkdisk/ui/button";
import { cn } from "@blinkdisk/utils/class";
import { useAccountId } from "@desktop/hooks/use-account-id";
import { formatHistoryTime, type SnapshotOutcome } from "@desktop/lib/history";
import { formatInt, formatSize } from "@desktop/lib/number";
import { buildSourceId } from "@desktop/lib/source";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ActivityEntry({
  vault,
  source,
  sourceName,
  startTime,
  endTime,
  outcome,
  summary,
  children,
}: {
  vault: { id: string; name: string };
  source: ZHistorySourceIdentityType;
  sourceName?: string;
  startTime: string;
  endTime: string;
  outcome: SnapshotOutcome | "failed";
  summary?: ZHistorySnapshotType["summary"];
  children?: ReactNode;
}) {
  const { t } = useAppTranslation("history");
  const { accountId } = useAccountId();
  const name = sourceName || source.path;

  return (
    <details data-slot="activity-entry" className="group @container text-sm">
      <summary className="flex min-h-9 cursor-pointer list-none items-start gap-2 px-3 py-2 outline-none hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 group-open:rotate-90"
        />
        <span className="grid min-w-0 flex-1 grid-cols-2 items-center gap-x-3 gap-y-1 @3xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto_minmax(0,1fr)]">
          <span className="col-span-2 truncate font-medium @3xl:col-span-1">
            {name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            <span className="sr-only">{t("calendar.vault")}: </span>
            {vault.name}
          </span>
          <time
            dateTime={endTime}
            className="text-xs tabular-nums text-muted-foreground"
          >
            <span aria-hidden="true">
              {new Date(endTime).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="sr-only">
              {t("calendar.ended", { time: formatHistoryTime(endTime) })}
            </span>
          </time>
          <span className="text-xs tabular-nums text-muted-foreground">
            <span className="sr-only">{t("calendar.sizeAndFiles")}: </span>
            {summary
              ? `${formatSize(summary.size)} · ${t("calendar.files", {
                  count: summary.files,
                  formatted: formatInt(summary.files),
                })}`
              : t("unavailable")}
          </span>
          <span
            className={cn(
              "text-xs",
              outcome === "completed"
                ? "text-success"
                : outcome === "failed"
                  ? "text-destructive"
                  : outcome === "unknown" || outcome === "canceled"
                    ? "text-muted-foreground"
                    : "text-warning",
            )}
          >
            {t(`outcome.${outcome}`)}
          </span>
        </span>
      </summary>
      <div className="space-y-2 border-t px-3 py-3">
        <p className="break-all font-medium">
          {name} · {vault.name}
        </p>
        <p className="break-all font-mono text-xs">
          {source.userName}@{source.host}:{source.path}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <p>{t("calendar.started", { time: formatHistoryTime(startTime) })}</p>
          <p>{t("calendar.ended", { time: formatHistoryTime(endTime) })}</p>
        </div>
        {children}
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={
            <Link
              to="/$accountId/$vaultId/$sourceId"
              params={{
                accountId: accountId ?? "",
                vaultId: vault.id,
                sourceId: buildSourceId({
                  device: source.host,
                  user: source.userName,
                  path: source.path,
                }),
              }}
              search={{
                otherHostName: source.host,
                otherUserName: source.userName,
              }}
            />
          }
        >
          {t("calendar.history")}
        </Button>
      </div>
    </details>
  );
}
