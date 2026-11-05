import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";
import { formatSize } from "@desktop/lib/number";
import { useState } from "react";

export function UpdateAction() {
  const { t } = useAppTranslation("update");
  const { status } = useUpdateStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  if (!status?.available) return null;
  const downloading =
    status.phase === "downloading" || status.phase === "canceling";
  const ready = status.phase === "ready";
  const installing = status.phase === "installing";
  const waiting = ready && status.activity !== "idle";
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button
        size="sm"
        disabled={busy || downloading || installing || waiting}
        aria-busy={busy || downloading || installing}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            if (ready) await window.electron.update.install();
            else await window.electron.update.download();
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {installing
          ? t("installing")
          : status.phase === "canceling"
            ? t("canceling")
            : downloading
              ? t("downloadProgress", {
                  percent: Math.floor(status.progress ?? 0),
                })
              : ready
                ? t("install")
                : t(status.manual ? "manual" : "download")}
      </Button>
      {downloading ? (
        <>
          <p className="text-xs tabular-nums text-muted-foreground">
            {status.transferred !== undefined && status.total !== undefined
              ? t("transfer", {
                  transferred: formatSize(status.transferred),
                  total: formatSize(status.total),
                })
              : t("preparing")}
            {status.bytesPerSecond !== undefined
              ? ` · ${t("speed", { speed: formatSize(status.bytesPerSecond) })}`
              : null}
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={cancelBusy || status.phase === "canceling"}
            onClick={async () => {
              setCancelBusy(true);
              setFailed(false);
              try {
                await window.electron.update.cancel();
              } catch {
                setFailed(true);
              } finally {
                setCancelBusy(false);
              }
            }}
          >
            {t("cancel")}
          </Button>
        </>
      ) : null}
      <span role="status" className="text-sm text-muted-foreground">
        {waiting
          ? t(
              status.activity === "busy"
                ? "waiting"
                : status.activity === "unknown"
                  ? "activityUnknown"
                  : "activityChecking",
            )
          : status.phase === "canceled"
            ? t("canceled")
            : null}
      </span>
      {failed || status.phase === "error" || status.installFailed ? (
        <span role="alert" className="text-sm text-destructive">
          {t("failed")}
        </span>
      ) : null}
      <details className="min-w-0 text-sm">
        <summary className="cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-ring">
          {t("notes")}
        </summary>
        <section
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Release notes need keyboard scrolling.
          tabIndex={0}
          aria-label={t("notes")}
          className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words border border-border p-3 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {status.notes?.trim() || t("noNotes")}
        </section>
      </details>
      {!downloading && !installing ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !!status.remindUntil}
          title={t("reminderDelay")}
          onClick={async () => {
            setFailed(false);
            setBusy(true);
            try {
              await window.electron.update.remindLater();
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(status.remindUntil ? "reminderSet" : "remindLater")}
        </Button>
      ) : null}
    </div>
  );
}
