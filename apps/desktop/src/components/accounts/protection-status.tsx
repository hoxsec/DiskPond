import type { ProtectionState } from "@desktop/lib/protection-status";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Button } from "@diskpond/ui/button";
import { cn } from "@diskpond/utils/class";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CircleHelpIcon,
  ClockIcon,
  CloudUploadIcon,
  FileWarningIcon,
  FolderPlusIcon,
  PauseIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  UnplugIcon,
} from "lucide-react";
import { type RefObject, useId } from "react";

const STATUS_ICONS = {
  current: ShieldCheckIcon,
  overdue: ClockIcon,
  unavailable: UnplugIcon,
  partial: FileWarningIcon,
  failed: FileWarningIcon,
  incomplete: FileWarningIcon,
  checking: RefreshCwIcon,
  empty: FolderPlusIcon,
  setup: FolderPlusIcon,
  unprotected: FolderPlusIcon,
  running: CloudUploadIcon,
  queued: ClockIcon,
  paused: PauseIcon,
  unknown: CircleHelpIcon,
  remote: ShieldCheckIcon,
  manual: ShieldCheckIcon,
};

type ProtectionStatusCardProps = {
  status: ProtectionState;
  summary: string;
  lastBackup: string;
  nextBackup: string;
  onAction?: () => void;
  action: string;
  actionPending?: boolean;
  actionRef?: RefObject<HTMLButtonElement | null>;
  opensDialog?: boolean;
};

export function ProtectionStatusCard({
  status,
  summary,
  lastBackup,
  nextBackup,
  onAction,
  action,
  actionPending,
  actionRef,
  opensDialog,
}: ProtectionStatusCardProps) {
  const { t } = useAppTranslation("vault.protection");
  const titleId = useId();
  const StatusIcon = STATUS_ICONS[status];
  const warning = [
    "overdue",
    "partial",
    "incomplete",
    "unprotected",
    "paused",
  ].includes(status);
  const error = status === "failed" || status === "unavailable";
  const accent =
    status === "current"
      ? "border-l-success"
      : error
        ? "border-l-destructive"
        : warning
          ? "border-l-warning"
          : "border-l-border";
  const iconColor =
    status === "current"
      ? "border-success/20 bg-success/5 text-success"
      : error
        ? "border-destructive/20 bg-destructive/5 text-destructive"
        : warning
          ? "border-warning/20 bg-warning/5 text-warning"
          : "border-border bg-muted/20 text-muted-foreground";
  const ActionIcon = status === "unavailable" ? RefreshCwIcon : ArrowRightIcon;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "@container border border-l-3 bg-card text-card-foreground",
        accent,
      )}
    >
      <div className="grid gap-4 p-4 @4xl:grid-cols-[minmax(0,1fr)_auto_auto] @4xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center border",
              iconColor,
            )}
          >
            <StatusIcon aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0" aria-live="polite" aria-atomic="true">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t("title")}
            </p>
            <h2 id={titleId} className="text-lg font-semibold leading-snug">
              {t(`states.${status}`)}
            </h2>
            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
              {summary}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 border-t pt-3 @sm:grid-cols-2 @4xl:gap-5 @4xl:border-l @4xl:border-t-0 @4xl:pl-5 @4xl:pt-0">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClockIcon aria-hidden="true" className="size-3.5 shrink-0" />
              {t("lastBackup")}
            </dt>
            <dd className="mt-1.5 text-xs font-medium tabular-nums">
              {lastBackup}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClockIcon
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
              {t("nextBackup")}
            </dt>
            <dd className="mt-1.5 text-xs font-medium tabular-nums">
              {nextBackup}
            </dd>
          </div>
        </dl>
        <Button
          ref={actionRef}
          variant="outline"
          size="sm"
          className="justify-self-start text-xs @4xl:justify-self-end"
          disabled={!onAction}
          loading={actionPending}
          aria-haspopup={opensDialog ? "dialog" : undefined}
          onClick={onAction}
        >
          {action}
          <ActionIcon aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}
