import { useAccountId } from "@desktop/hooks/use-account-id";
import { formatHistoryTime, type SnapshotOutcome } from "@desktop/lib/history";
import { formatInt, formatSize } from "@desktop/lib/number";
import { buildSourceId } from "@desktop/lib/source";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type {
  ZHistorySnapshotType,
  ZHistorySourceIdentityType,
} from "@diskpond/schemas/history";
import { Button } from "@diskpond/ui/button";
import { cn } from "@diskpond/utils/class";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleHelpIcon,
} from "lucide-react";
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
  const { t, language } = useAppTranslation("history");
  const { accountId } = useAccountId();
  const name = sourceName || source.path;
  const OutcomeIcon =
    outcome === "completed"
      ? CheckIcon
      : outcome === "unknown" || outcome === "canceled"
        ? CircleHelpIcon
        : AlertTriangleIcon;
  const outcomeClass =
    outcome === "completed"
      ? "text-success"
      : outcome === "failed"
        ? "text-destructive"
        : outcome === "unknown" || outcome === "canceled"
          ? "text-muted-foreground"
          : "text-warning";

  return (
    <details
      data-slot="activity-entry"
      className="group @container border bg-card text-sm"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 outline-none hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center border bg-muted",
            outcomeClass,
          )}
        >
          <OutcomeIcon aria-hidden="true" className="size-4" />
        </span>
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
              {new Date(endTime).toLocaleTimeString(language, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="sr-only">
              {t("calendar.ended", {
                time: formatHistoryTime(endTime, language),
              })}
            </span>
          </time>
          <span className="text-xs tabular-nums text-muted-foreground">
            <span className="sr-only">{t("calendar.sizeAndFiles")}: </span>
            {summary
              ? `${formatSize(summary.size, { locale: language })} · ${t(
                  "calendar.files",
                  {
                    count: summary.files,
                    formatted: formatInt(summary.files, language),
                  },
                )}`
              : t("unavailable")}
          </span>
          <span className={cn("text-xs", outcomeClass)}>
            {t(`outcome.${outcome}`)}
          </span>
        </span>
        <ChevronRightIcon
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground group-open:rotate-90"
        />
      </summary>
      <div className="space-y-3 border-t bg-muted/30 p-4">
        <p className="break-all font-medium">
          {name} · {vault.name}
        </p>
        <p className="break-all font-mono text-xs">
          {source.userName}@{source.host}:{source.path}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <p>
            {t("calendar.started", {
              time: formatHistoryTime(startTime, language),
            })}
          </p>
          <p>
            {t("calendar.ended", {
              time: formatHistoryTime(endTime, language),
            })}
          </p>
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
