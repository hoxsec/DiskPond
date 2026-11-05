import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { ReleaseNotes } from "@desktop/components/settings/release-notes";
import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";

export function UpdateNotes() {
  const { t } = useAppTranslation("update");
  const { status } = useUpdateStatus();
  if (!status?.available) return null;

  return (
    <details className="min-w-0 text-sm">
      <summary className="cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-ring">
        {t("notes")}
      </summary>
      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Release notes need keyboard scrolling.
        tabIndex={0}
        aria-label={t("notes")}
        className="mt-2 max-h-96 overflow-auto break-words rounded-lg border border-border p-4 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {status.notes?.trim() ? (
          <ReleaseNotes>{status.notes}</ReleaseNotes>
        ) : (
          <p className="text-muted-foreground">{t("noNotes")}</p>
        )}
      </section>
    </details>
  );
}
