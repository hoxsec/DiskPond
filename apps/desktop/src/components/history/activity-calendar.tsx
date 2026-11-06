import { ActivityEntry } from "@desktop/components/history/activity-entry";
import { ActivityVaultCard } from "@desktop/components/history/activity-vault-card";
import { HistorySelect } from "@desktop/components/history/select";
import { useBackupActivity } from "@desktop/hooks/queries/use-backup-activity";
import {
  activityMonthDays,
  activitySourceKey,
  groupActivityDays,
  localDayKey,
  shiftActivityMonth,
} from "@desktop/lib/backup-activity";
import { formatHistoryTime } from "@desktop/lib/history";
import type { StorageProviderType } from "@diskpond/constants/providers";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { ZHistorySourceIdentityType } from "@diskpond/schemas/history";
import { Button } from "@diskpond/ui/button";
import { cn } from "@diskpond/utils/class";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type ActivityVault = {
  id: string;
  name: string;
  provider?: StorageProviderType;
};

export function BackupActivityCalendar({
  vaults,
  scoped = false,
  initialHost = "",
  initialUser = "",
}: {
  vaults: ActivityVault[];
  scoped?: boolean;
  initialHost?: string;
  initialUser?: string;
}) {
  const { t, language } = useAppTranslation("history");
  const [vaultFilter, setVaultFilter] = useState("");
  const [host, setHost] = useState(initialHost);
  const [user, setUser] = useState(initialUser);
  const [sourceFilter, setSourceFilter] = useState("");
  const [selected, setSelected] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const selectedKey = localDayKey(selected);
  const visibleVaults = vaults.filter(
    (vault) => !vaultFilter || vault.id === vaultFilter,
  );
  const queries = useBackupActivity(vaults.map((vault) => vault.id));
  const visibleQueries = queries.filter((_, index) =>
    visibleVaults.some((vault) => vault.id === vaults[index]?.id),
  );
  const available = visibleQueries.flatMap((query) =>
    !query.isError && query.data ? [query.data] : [],
  );
  const allSources = available.flatMap((history) =>
    history.sources.map((item) => ({ ...item, vaultId: history.vaultId })),
  );
  const matches = (source: ZHistorySourceIdentityType) =>
    (!host || source.host === host) &&
    (!user || source.userName === user) &&
    (!sourceFilter || activitySourceKey(source) === sourceFilter);
  const records = available
    .flatMap((history) => history.records)
    .filter((record) => matches(record.source));
  const days = groupActivityDays(records);
  const issues = allSources.filter(
    (item) =>
      matches(item.source) &&
      item.lastBackupOutcome &&
      item.lastBackupOutcome.status !== "SUCCESS",
  );
  const selectedRecords = days.get(selectedKey) ?? [];
  const selectedIssues = issues.filter(
    (item) =>
      item.lastBackupOutcome &&
      localDayKey(item.lastBackupOutcome.endTime) === selectedKey,
  );
  const active = allSources.filter(
    (item) =>
      matches(item.source) &&
      (item.status === "UPLOADING" || item.status === "PENDING"),
  );
  const monthDays = useMemo(() => activityMonthDays(selected), [selected]);
  const gridRef = useRef<HTMLTableElement>(null);
  const focusDay = useRef(false);
  const titleId = useId();
  const dayTitleId = useId();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const monthLabel = selected.toLocaleDateString(language, {
    month: "long",
    year: "numeric",
  });
  const fullDate = (date: Date) =>
    date.toLocaleDateString(language, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const vaultName = (id: string) =>
    vaults.find((vault) => vault.id === id)?.name ?? id;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(selectedRecords.length / 50) - 1),
  );
  const incompleteCoverage =
    visibleQueries.some((query) => query.isPending || query.isError) ||
    available.some(
      (history) => history.limited || history.unavailableSources.length,
    );
  const updatedAt = queries
    .filter((query) => !query.isError)
    .flatMap((query) => (query.data?.fetchedAt ? [query.data.fetchedAt] : []))
    .sort()[0];

  useEffect(() => {
    if (!focusDay.current) return;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${selectedKey}"]`)
      ?.focus();
    focusDay.current = false;
  }, [selectedKey]);

  function selectDay(date: Date, focus = false) {
    focusDay.current = focus;
    setSelected(date);
    setPage(0);
  }

  function onDayKey(event: KeyboardEvent<HTMLButtonElement>, day: Date) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
      event.key
    ];
    let next: Date | undefined;
    if (delta !== undefined)
      next = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() + delta,
        12,
      );
    if (event.key === "Home")
      next = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() - ((day.getDay() + 6) % 7),
        12,
      );
    if (event.key === "End")
      next = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() + 6 - ((day.getDay() + 6) % 7),
        12,
      );
    if (event.key === "PageUp" || event.key === "PageDown")
      next = shiftActivityMonth(day, event.key === "PageUp" ? -1 : 1);
    if (next) {
      event.preventDefault();
      selectDay(next, true);
    }
  }

  const filterItems = (values: string[], all: string, current: string) => [
    { value: "", label: all },
    ...Array.from(new Set([...values, ...(current ? [current] : [])]))
      .sort()
      .map((value) => ({ value, label: value })),
  ];

  return (
    <section aria-labelledby={titleId} className="@container min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-xl font-semibold">
            {t("calendar.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("calendar.zone", { zone: timeZone })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {updatedAt ? (
            <p
              className="text-xs text-muted-foreground"
              title={formatHistoryTime(updatedAt, language)}
            >
              {t("calendar.updated", {
                time: new Date(updatedAt).toLocaleTimeString(language, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </p>
          ) : null}
          <Button
            variant="secondary"
            disabled={queries.some((query) => query.isFetching)}
            onClick={() => {
              for (const query of queries) void query.refetch();
            }}
          >
            <RefreshCwIcon aria-hidden="true" />
            {t("calendar.refresh")}
          </Button>
        </div>
      </div>
      <ul
        className="grid gap-4 @sm:grid-cols-2 @4xl:grid-cols-4"
        aria-label={t("calendar.availability")}
      >
        {queries.map((query, index) => {
          const vault = vaults[index];
          return vault ? (
            <ActivityVaultCard
              key={vault.id}
              vault={vault}
              query={query}
              selected={vaultFilter === vault.id}
              onSelect={() => {
                setVaultFilter(vaultFilter === vault.id ? "" : vault.id);
                setSourceFilter("");
                setPage(0);
              }}
            />
          ) : null;
        })}
      </ul>
      <div className="grid gap-3 lg:grid-cols-3">
        {!scoped && (
          <HistorySelect
            label={t("calendar.vault")}
            value={vaultFilter}
            items={[
              { value: "", label: t("calendar.allVaults") },
              ...vaults.map((vault) => ({
                value: vault.id,
                label: vault.name,
              })),
            ]}
            onChange={(value) => {
              setVaultFilter(value);
              setSourceFilter("");
              setPage(0);
            }}
          />
        )}
        {scoped && (
          <>
            <HistorySelect
              label={t("calendar.device")}
              value={host}
              items={filterItems(
                allSources.map((item) => item.source.host),
                t("calendar.allDevices"),
                host,
              )}
              onChange={(value) => {
                setHost(value);
                setUser("");
                setSourceFilter("");
                setPage(0);
              }}
            />
            <HistorySelect
              label={t("calendar.user")}
              value={user}
              items={filterItems(
                allSources
                  .filter((item) => !host || item.source.host === host)
                  .map((item) => item.source.userName),
                t("calendar.allUsers"),
                user,
              )}
              onChange={(value) => {
                setUser(value);
                setSourceFilter("");
                setPage(0);
              }}
            />
            <HistorySelect
              label={t("calendar.source")}
              value={sourceFilter}
              items={[
                { value: "", label: t("calendar.allSources") },
                ...Array.from(
                  new Map(
                    allSources
                      .filter(
                        (item) =>
                          (!host || item.source.host === host) &&
                          (!user || item.source.userName === user),
                      )
                      .map((item) => [
                        activitySourceKey(item.source),
                        {
                          value: activitySourceKey(item.source),
                          label: `${item.name ? `${item.name} — ` : ""}${item.source.userName}@${item.source.host}:${item.source.path}`,
                        },
                      ]),
                  ).values(),
                ),
              ]}
              onChange={(value) => {
                setSourceFilter(value);
                setPage(0);
              }}
            />
          </>
        )}
      </div>
      {active.length > 0 && (
        <div className="space-y-2 border bg-card p-4">
          <h3 className="font-medium">{t("calendar.active")}</h3>
          {active.slice(0, 100).map((item) => (
            <p
              key={`${item.vaultId}:${activitySourceKey(item.source)}`}
              className="break-all text-sm"
            >
              {vaultName(item.vaultId)} · {item.source.path} ·{" "}
              {t(
                item.status === "PENDING"
                  ? "calendar.queued"
                  : "calendar.running",
              )}
            </p>
          ))}
          {active.length > 100 && <p>{t("calendar.moreActive")}</p>}
        </div>
      )}
      <div className="grid items-start gap-6 @4xl:grid-cols-2">
        <div className="min-w-0 space-y-4 border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold" aria-live="polite">
              {monthLabel}
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={t("calendar.previousMonth")}
                onClick={() => selectDay(shiftActivityMonth(selected, -1))}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selectDay(new Date())}
              >
                {t("calendar.today")}
              </Button>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={t("calendar.nextMonth")}
                onClick={() => selectDay(shiftActivityMonth(selected, 1))}
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table
              ref={gridRef}
              className="w-full min-w-84 table-fixed border-collapse"
            >
              <caption className="sr-only">
                {t("calendar.month", { month: monthLabel })}
              </caption>
              <thead>
                <tr>
                  {monthDays.slice(0, 7).map((day) => (
                    <th
                      key={day.getDay()}
                      scope="col"
                      className="p-2 text-xs font-medium text-muted-foreground"
                      aria-label={day.toLocaleDateString(language, {
                        weekday: "long",
                      })}
                    >
                      {day.toLocaleDateString(language, { weekday: "short" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: monthDays.length / 7 }, (_, week) => (
                  <tr key={week}>
                    {monthDays.slice(week * 7, week * 7 + 7).map((day) => {
                      const key = localDayKey(day);
                      const dayRecords = days.get(key) ?? [];
                      const dayIssues = issues.filter(
                        (item) =>
                          item.lastBackupOutcome &&
                          localDayKey(item.lastBackupOutcome.endTime) === key,
                      );
                      const outcomes = Array.from(
                        new Set(dayRecords.map((record) => record.outcome)),
                      );
                      const summary = outcomes
                        .map(
                          (outcome) =>
                            `${t(`outcome.${outcome}`)}: ${dayRecords.filter((record) => record.outcome === outcome).length}`,
                        )
                        .join(", ");
                      const warning = outcomes.some((outcome) =>
                        ["partial", "incomplete", "canceled"].includes(outcome),
                      );
                      return (
                        <td key={key} className="border p-0 align-top">
                          <button
                            type="button"
                            data-day={key}
                            tabIndex={key === selectedKey ? 0 : -1}
                            aria-pressed={key === selectedKey}
                            aria-current={
                              key === localDayKey(new Date())
                                ? "date"
                                : undefined
                            }
                            aria-label={`${fullDate(day)}. ${t("calendar.dayCount", { count: dayRecords.length })}. ${summary}. ${t("calendar.issueCount", { count: dayIssues.length })}${incompleteCoverage ? `. ${t("calendar.incompleteCoverage")}` : ""}`}
                            onKeyDown={(event) => onDayKey(event, day)}
                            onClick={() => selectDay(day)}
                            className={cn(
                              "flex min-h-20 w-full flex-col items-center gap-1 p-2 text-sm outline-none hover:bg-card-hover focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                              day.getMonth() !== selected.getMonth() &&
                                "text-muted-foreground",
                              key === selectedKey &&
                                "bg-accent text-accent-foreground",
                            )}
                          >
                            <span className="font-medium tabular-nums">
                              {day.getDate()}
                            </span>
                            <span className="text-xs tabular-nums">
                              {dayRecords.length || "—"}
                            </span>
                            <span
                              className="flex flex-wrap justify-center gap-1"
                              aria-hidden="true"
                            >
                              {outcomes.includes("completed") && (
                                <CheckIcon className="size-4 text-success" />
                              )}
                              {warning && (
                                <AlertTriangleIcon className="size-4 text-warning" />
                              )}
                              {outcomes.includes("unknown") && (
                                <CircleHelpIcon className="size-4 text-muted-foreground" />
                              )}
                              {dayIssues.length > 0 && (
                                <span className="text-xs text-destructive">
                                  {t("calendar.issueMark", {
                                    count: dayIssues.length,
                                  })}
                                </span>
                              )}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <section aria-labelledby={dayTitleId} className="min-w-0 space-y-4">
          <h3 id={dayTitleId} className="text-lg font-semibold">
            {fullDate(selected)}
          </h3>
          {!selectedRecords.length && (
            <p className="border bg-card p-6 text-sm text-muted-foreground">
              {t(
                incompleteCoverage ? "calendar.emptyUnknown" : "calendar.empty",
              )}
            </p>
          )}
          {selectedRecords.length > 0 && (
            <ol className="space-y-3">
              {selectedRecords
                .slice(currentPage * 50, (currentPage + 1) * 50)
                .map((record) => (
                  <li key={`${record.vaultId}:${record.snapshot.id}`}>
                    <ActivityEntry
                      vault={{
                        id: record.vaultId,
                        name: vaultName(record.vaultId),
                      }}
                      source={record.source}
                      sourceName={record.sourceName}
                      startTime={record.snapshot.startTime}
                      endTime={record.snapshot.endTime}
                      outcome={record.outcome}
                      summary={record.snapshot.summary}
                    >
                      {record.snapshot.description && (
                        <p className="break-all">
                          {record.snapshot.description}
                        </p>
                      )}
                      {record.snapshot.incomplete && (
                        <p className="break-all">
                          {t("calendar.incompleteReason", {
                            reason: record.snapshot.incomplete,
                          })}
                        </p>
                      )}
                      {record.snapshot.summary?.errors?.length ? (
                        <div>
                          <p className="font-medium">{t("calendar.details")}</p>
                          <ul>
                            {record.snapshot.summary.errors.map(
                              (error, index) => (
                                <li key={index} className="break-all">
                                  {error.path}: {error.error}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </ActivityEntry>
                  </li>
                ))}
            </ol>
          )}
          {selectedRecords.length > 50 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("previous")}
              </Button>
              <p className="text-sm">
                {t("page", {
                  page: currentPage + 1,
                  count: Math.ceil(selectedRecords.length / 50),
                })}
              </p>
              <Button
                variant="secondary"
                disabled={(currentPage + 1) * 50 >= selectedRecords.length}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("next")}
              </Button>
            </div>
          )}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium">
              {t("calendar.latestIssues")}
            </h4>
            {selectedIssues.length ? (
              <ul className="space-y-3">
                {selectedIssues.slice(0, 100).map((item) => {
                  const outcome = item.lastBackupOutcome;
                  if (!outcome) return null;
                  return (
                    <li
                      key={`${item.vaultId}:${activitySourceKey(item.source)}`}
                    >
                      <ActivityEntry
                        vault={{
                          id: item.vaultId,
                          name: vaultName(item.vaultId),
                        }}
                        source={item.source}
                        sourceName={item.name}
                        startTime={outcome.startTime}
                        endTime={outcome.endTime}
                        outcome={
                          outcome.status === "FAILED" ? "failed" : "partial"
                        }
                      >
                        <p className="break-all">
                          {outcome.errorMessage || t("calendar.noIssueDetails")}
                        </p>
                        {outcome.errorCount !== undefined && (
                          <p>
                            {t("calendar.errorCount", {
                              count: outcome.errorCount,
                            })}
                          </p>
                        )}
                      </ActivityEntry>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("calendar.noKnownIssues")}
              </p>
            )}
            {selectedIssues.length > 100 && <p>{t("calendar.moreIssues")}</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
