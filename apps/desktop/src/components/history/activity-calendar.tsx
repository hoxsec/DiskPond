import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type { ZHistorySourceIdentityType } from "@blinkdisk/schemas/history";
import { Button } from "@blinkdisk/ui/button";
import { cn } from "@blinkdisk/utils/class";
import { HistorySelect } from "@desktop/components/history/select";
import { useBackupActivity } from "@desktop/hooks/queries/use-backup-activity";
import { useAccountId } from "@desktop/hooks/use-account-id";
import {
  activityMonthDays,
  activitySourceKey,
  groupActivityDays,
  localDayKey,
  shiftActivityMonth,
} from "@desktop/lib/backup-activity";
import { formatHistoryTime } from "@desktop/lib/history";
import { buildSourceId } from "@desktop/lib/source";
import { Link } from "@tanstack/react-router";
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

type ActivityVault = { id: string; name: string };

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
  const { t } = useAppTranslation("history");
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
  const queries = useBackupActivity(visibleVaults.map((vault) => vault.id));
  const available = queries.flatMap((query) =>
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
  const monthLabel = selected.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const fullDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
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
    queries.some((query) => query.isPending || query.isError) ||
    available.some(
      (history) => history.limited || history.unavailableSources.length,
    );

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
    <section
      aria-labelledby={titleId}
      className="min-w-0 space-y-5 border bg-card p-4 lg:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-xl font-semibold">
            {t("calendar.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("calendar.zone", { zone: timeZone })}
          </p>
        </div>
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
      <ul className="space-y-1 text-sm" aria-label={t("calendar.availability")}>
        {queries.map((query, index) => {
          const vault = visibleVaults[index];
          if (!vault) return null;
          return (
            <li
              key={vault.id}
              className={
                query.isError ||
                query.data?.unavailableSources.length ||
                query.data?.limited
                  ? "text-warning"
                  : "text-muted-foreground"
              }
            >
              {vault.name}:{" "}
              {query.isError
                ? t("calendar.offline")
                : query.isPending
                  ? t("loading")
                  : t("calendar.loaded", {
                      count: query.data?.records.length,
                      time: formatHistoryTime(query.data?.fetchedAt),
                    })}
              {query.isFetching && !query.isPending
                ? ` · ${t("calendar.refreshing")}`
                : ""}
              {!query.isError && query.data?.unavailableSources.length ? (
                <details>
                  <summary className="cursor-pointer py-1">
                    {t("calendar.missingSources", {
                      count: query.data.unavailableSources.length,
                    })}
                  </summary>
                  <ul>
                    {query.data.unavailableSources.map((source) => (
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
              {!query.isError && query.data?.limited ? (
                <p>{t("calendar.limited")}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {active.length > 0 && (
        <div className="space-y-2 border p-3">
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
                  aria-label={day.toLocaleDateString(undefined, {
                    weekday: "long",
                  })}
                >
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
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
                          key === localDayKey(new Date()) ? "date" : undefined
                        }
                        aria-label={`${fullDate(day)}. ${t("calendar.dayCount", { count: dayRecords.length })}. ${summary}. ${t("calendar.issueCount", { count: dayIssues.length })}${incompleteCoverage ? `. ${t("calendar.incompleteCoverage")}` : ""}`}
                        onKeyDown={(event) => onDayKey(event, day)}
                        onClick={() => selectDay(day)}
                        className={cn(
                          "flex min-h-24 w-full flex-col items-center gap-1 p-2 text-sm outline-none hover:bg-card-hover focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
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
      <section aria-labelledby={dayTitleId} className="space-y-3">
        <h3 id={dayTitleId} className="text-lg font-semibold">
          {fullDate(selected)}
        </h3>
        {!selectedRecords.length && (
          <p className="text-sm text-muted-foreground">
            {t(incompleteCoverage ? "calendar.emptyUnknown" : "calendar.empty")}
          </p>
        )}
        <ol className="space-y-3">
          {selectedRecords
            .slice(currentPage * 50, (currentPage + 1) * 50)
            .map((record) => (
              <li
                key={`${record.vaultId}:${record.snapshot.id}`}
                className="space-y-2 border p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {vaultName(record.vaultId)} ·{" "}
                    {record.sourceName || record.source.path}
                  </p>
                  <p
                    className={
                      record.outcome === "completed"
                        ? "text-success"
                        : "text-warning"
                    }
                  >
                    {t(`outcome.${record.outcome}`)}
                  </p>
                </div>
                <p className="break-all font-mono text-xs">
                  {record.source.userName}@{record.source.host}:
                  {record.source.path}
                </p>
                {record.snapshot.description && (
                  <p>{record.snapshot.description}</p>
                )}
                <p>
                  {t("calendar.started", {
                    time: formatHistoryTime(record.snapshot.startTime),
                  })}
                </p>
                <p>
                  {t("calendar.ended", {
                    time: formatHistoryTime(record.snapshot.endTime),
                  })}
                </p>
                {record.snapshot.incomplete && (
                  <p>
                    {t("calendar.incompleteReason", {
                      reason: record.snapshot.incomplete,
                    })}
                  </p>
                )}
                {record.snapshot.summary?.errors?.length ? (
                  <details>
                    <summary className="cursor-pointer">
                      {t("calendar.details")}
                    </summary>
                    <ul>
                      {record.snapshot.summary.errors.map((error, index) => (
                        <li key={index} className="break-all">
                          {error.path}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <ActivityHistoryLink
                  vaultId={record.vaultId}
                  source={record.source}
                />
              </li>
            ))}
        </ol>
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
          <h4 className="font-medium">{t("calendar.latestIssues")}</h4>
          {selectedIssues.length ? (
            selectedIssues.slice(0, 100).map((item) => (
              <div
                key={`${item.vaultId}:${activitySourceKey(item.source)}`}
                className="space-y-2 border border-warning p-4 text-sm"
              >
                <p className="font-medium">
                  {vaultName(item.vaultId)} ·{" "}
                  {t(
                    item.lastBackupOutcome?.status === "FAILED"
                      ? "outcome.failed"
                      : "outcome.partial",
                  )}
                </p>
                <p className="break-all font-mono">
                  {item.source.userName}@{item.source.host}:{item.source.path}
                </p>
                <p>
                  {t("calendar.started", {
                    time: formatHistoryTime(item.lastBackupOutcome?.startTime),
                  })}
                </p>
                <p>
                  {t("calendar.ended", {
                    time: formatHistoryTime(item.lastBackupOutcome?.endTime),
                  })}
                </p>
                <p className="break-words">
                  {item.lastBackupOutcome?.errorMessage ||
                    t("calendar.noIssueDetails")}
                </p>
                {item.lastBackupOutcome?.errorCount !== undefined && (
                  <p>
                    {t("calendar.errorCount", {
                      count: item.lastBackupOutcome.errorCount,
                    })}
                  </p>
                )}
                <ActivityHistoryLink
                  vaultId={item.vaultId}
                  source={item.source}
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("calendar.noKnownIssues")}
            </p>
          )}
          {selectedIssues.length > 100 && <p>{t("calendar.moreIssues")}</p>}
        </div>
      </section>
    </section>
  );
}

function ActivityHistoryLink({
  vaultId,
  source,
}: {
  vaultId: string;
  source: ZHistorySourceIdentityType;
}) {
  const { t } = useAppTranslation("history");
  const { accountId } = useAccountId();
  return (
    <Button
      variant="secondary"
      size="sm"
      nativeButton={false}
      render={
        <Link
          to="/$accountId/$vaultId/$sourceId"
          params={{
            accountId: accountId ?? "",
            vaultId,
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
  );
}
