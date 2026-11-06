import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";

export function UpdateHistory() {
  const { t, language } = useAppTranslation("update");
  const { status } = useUpdateStatus();
  if (!status) return null;
  return (
    <details className="min-w-0 text-sm">
      <summary className="cursor-pointer py-1 focus-visible:outline-2 focus-visible:outline-ring">
        {t("history")}
      </summary>
      <p className="py-2 text-muted-foreground">
        {t("currentVersion", { version: status.currentVersion })}
      </p>
      {status.historyUnavailable ? (
        <p role="alert" className="text-destructive">
          {t("historyUnavailable")}
        </p>
      ) : null}
      {status.history.length ? (
        <ul
          className="max-h-80 overflow-y-auto divide-y divide-border"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: The bounded history list needs keyboard scrolling.
          tabIndex={0}
          aria-label={t("history")}
        >
          {status.history.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
            >
              <span>
                {t("versionChange", {
                  from: item.fromVersion,
                  to: item.version,
                })}
              </span>
              <span>{t(`outcomes.${item.outcome}`)}</span>
              <time
                dateTime={item.updatedAt}
                className="w-full text-xs text-muted-foreground"
              >
                {new Date(item.updatedAt).toLocaleString(language)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-muted-foreground">{t("emptyHistory")}</p>
      )}
    </details>
  );
}
