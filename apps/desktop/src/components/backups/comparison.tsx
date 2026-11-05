import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type { ZHistorySourceIdentityType } from "@blinkdisk/schemas/history";
import { Button } from "@blinkdisk/ui/button";
import { Input } from "@blinkdisk/ui/input";
import { HistorySelect } from "@desktop/components/history/select";
import { useSnapshotHistory } from "@desktop/hooks/queries/core/use-snapshot-history";
import { useSnapshotComparison } from "@desktop/hooks/use-snapshot-comparison";
import { formatHistoryTime, snapshotOutcome } from "@desktop/lib/history";
import { formatSize } from "@desktop/lib/number";
import { comparisonSize } from "@desktop/lib/snapshot-comparison";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowLeftRightIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

const PAGE_SIZE = 100;

export function SnapshotComparison({
  vaultId,
  source,
  selectedSnapshot,
}: {
  vaultId: string;
  source: ZHistorySourceIdentityType;
  selectedSnapshot?: string;
}) {
  const { t, language } = useAppTranslation("history");
  const history = useSnapshotHistory(vaultId, source);
  const snapshots = history.data;
  const [afterId, setAfterId] = useState(selectedSnapshot);
  const [beforeId, setBeforeId] = useState<string>();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const filterId = useId();
  const after = afterId
    ? snapshots?.find((item) => item.id === afterId)
    : (snapshots?.find((item) => !item.incomplete) ?? snapshots?.[0]);
  const before = beforeId
    ? snapshots?.find((item) => item.id === beforeId)
    : snapshots?.find(
        (item) =>
          after &&
          item.id !== after.id &&
          Date.parse(item.startTime) <= Date.parse(after.startTime) &&
          !item.incomplete,
      );
  const { result, cancel, retry } = useSnapshotComparison(
    vaultId,
    source,
    before,
    after,
  );
  const rows = useMemo(
    () =>
      result?.rows.filter((row) =>
        (row.path.join("/") || ".")
          .toLocaleLowerCase()
          .includes(filter.toLocaleLowerCase()),
      ) ?? [],
    [result, filter],
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1),
  );
  const items =
    snapshots?.map((snapshot) => ({
      value: snapshot.id,
      label: `${formatHistoryTime(snapshot.startTime, language)}${snapshot.description ? ` — ${snapshot.description}` : ""} · ${t(`outcome.${snapshotOutcome(snapshot)}`)} · ${snapshot.id.slice(0, 8)}`,
    })) ?? [];
  const counts = { added: 0, changed: 0, deleted: 0, unknown: 0 };
  for (const row of result?.rows ?? []) counts[row.kind]++;
  const unavailable = t("unavailable");

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-6 overflow-y-auto p-6">
      <Button
        variant="secondary"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={
          <Link
            to="/$accountId/$vaultId/$sourceId"
            from="/$accountId/$vaultId/$sourceId/compare"
            search={({ otherHostName, otherUserName }) => ({
              otherHostName,
              otherUserName,
            })}
          />
        }
      >
        <ArrowLeftIcon aria-hidden="true" />
        {t("comparison.back")}
      </Button>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("comparison.title")}</h1>
        <p className="break-all font-mono text-sm">
          {source.userName}@{source.host}:{source.path}
        </p>
        <Button
          variant="secondary"
          disabled={history.isFetching}
          onClick={() => history.refetch()}
        >
          {t("calendar.refresh")}
        </Button>
      </header>
      {history.isError ? (
        <div role="alert" className="space-y-3 border border-warning p-4">
          <p>{t("comparison.loadError")}</p>
          <Button variant="secondary" onClick={() => history.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !snapshots ? (
        <p role="status">{t("loading")}</p>
      ) : snapshots.length < 2 ? (
        <p role="status">{t("comparison.insufficient")}</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <HistorySelect
              label={t("comparison.before")}
              value={before?.id ?? ""}
              items={items}
              onChange={(id) => {
                setBeforeId(id);
                setPage(0);
              }}
            />
            <HistorySelect
              label={t("comparison.after")}
              value={after?.id ?? ""}
              items={items}
              onChange={(id) => {
                setAfterId(id);
                setPage(0);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={!before || !after}
              onClick={() => {
                setBeforeId(after?.id);
                setAfterId(before?.id);
                setPage(0);
              }}
            >
              <ArrowLeftRightIcon aria-hidden="true" />
              {t("comparison.swap")}
            </Button>
            {([before, after] as const).map((snapshot, index) =>
              snapshot ? (
                <Button
                  key={index}
                  variant="secondary"
                  nativeButton={false}
                  render={
                    snapshot.rootEntryType === "d" ? (
                      <Link
                        to="/$accountId/$vaultId/$sourceId/$backupId/$directoryId"
                        from="/$accountId/$vaultId/$sourceId/compare"
                        params={{
                          backupId: snapshot.id,
                          directoryId: snapshot.rootID,
                        }}
                        search={({ otherHostName, otherUserName }) => ({
                          otherHostName,
                          otherUserName,
                        })}
                      />
                    ) : (
                      <Link
                        to="/$accountId/$vaultId/$sourceId"
                        from="/$accountId/$vaultId/$sourceId/compare"
                        search={({ otherHostName, otherUserName }) => ({
                          otherHostName,
                          otherUserName,
                        })}
                      />
                    )
                  }
                >
                  {t(
                    snapshot.rootEntryType === "d"
                      ? index === 0
                        ? "comparison.browseBefore"
                        : "comparison.browseAfter"
                      : "comparison.back",
                  )}
                </Button>
              ) : null,
            )}
          </div>
          {!before || !after ? (
            <p role="status">{t("comparison.choosePair")}</p>
          ) : before.id === after.id ? (
            <p role="status">{t("comparison.same")}</p>
          ) : (
            <>
              {(snapshotOutcome(before) !== "completed" ||
                snapshotOutcome(after) !== "completed") && (
                <p className="text-sm text-warning">
                  {t("comparison.coverage")}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p role="status">
                  {t(`comparison.status.${result?.status ?? "running"}`, {
                    count: result?.visited ?? 0,
                  })}
                </p>
                {result?.status === "running" ? (
                  <Button variant="secondary" onClick={cancel}>
                    {t("comparison.cancel")}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={retry}>
                    {t("retry")}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {(["added", "changed", "deleted", "unknown"] as const).map(
                  (kind) => (
                    <div key={kind} className="border bg-card p-4">
                      <p className="text-sm text-muted-foreground">
                        {t(`comparison.kind.${kind}`)}
                      </p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {counts[kind].toLocaleString(language)}
                      </p>
                    </div>
                  ),
                )}
              </div>
              {result?.issues.some(
                (item) => item.reason === "read" || item.reason === "limit",
              ) && (
                <div
                  role="alert"
                  className="border border-warning p-4 text-sm text-warning"
                >
                  <p>{t("comparison.readIssues")}</p>
                  <ul className="mt-2 max-h-40 overflow-auto">
                    {result.issues
                      .filter(
                        (item) =>
                          item.reason === "read" || item.reason === "limit",
                      )
                      .map((item, index) => (
                        <li key={index} className="break-all">
                          {item.path.join("/") || "."}:{" "}
                          {t(`comparison.issue.${item.reason}`)}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor={filterId} className="text-sm font-medium">
                  {t("comparison.filter")}
                </label>
                <Input
                  id={filterId}
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              {rows.length ? (
                <section
                  aria-label={t("comparison.table")}
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the metadata table in both directions.
                  tabIndex={0}
                  className="max-h-128 shrink-0 overflow-auto border outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      {t("comparison.table")}
                    </caption>
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {[
                          "path",
                          "change",
                          "beforeType",
                          "afterType",
                          "beforeSize",
                          "afterSize",
                          "beforeTime",
                          "afterTime",
                        ].map((key) => (
                          <th
                            key={key}
                            scope="col"
                            className="whitespace-nowrap p-3 font-medium"
                          >
                            {t(`comparison.columns.${key}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .slice(
                          currentPage * PAGE_SIZE,
                          (currentPage + 1) * PAGE_SIZE,
                        )
                        .map((row) => (
                          <tr
                            key={JSON.stringify(row.path)}
                            className="border-t align-top"
                          >
                            <th
                              scope="row"
                              className="max-w-96 break-all p-3 font-mono font-normal"
                            >
                              {row.path.join("/") || "."}
                            </th>
                            <td className="p-3">
                              {t(`comparison.kind.${row.kind}`)}
                            </td>
                            {[row.before, row.after].map((entry, index) => (
                              <td key={index} className="p-3">
                                {entry
                                  ? t(`type.${entry.type ?? "unknown"}`)
                                  : t(
                                      row.kind === "unknown"
                                        ? "unavailable"
                                        : "absent",
                                    )}
                              </td>
                            ))}
                            {[row.before, row.after].map((entry, index) => {
                              const size = comparisonSize(entry);
                              return (
                                <td
                                  key={index}
                                  className="whitespace-nowrap p-3 tabular-nums"
                                >
                                  {size === undefined
                                    ? unavailable
                                    : formatSize(size, { locale: language })}
                                  {size !== undefined && size >= 1024 && (
                                    <span className="block text-xs text-muted-foreground">
                                      {t("comparison.exactBytes", {
                                        value: size.toLocaleString(language),
                                      })}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            {[row.before, row.after].map((entry, index) => (
                              <td
                                key={index}
                                className="whitespace-nowrap p-3 tabular-nums"
                              >
                                {formatHistoryTime(entry?.mtime, language) ??
                                  unavailable}
                                {entry?.mtime && (
                                  <span className="block font-mono text-xs text-muted-foreground">
                                    {entry.mtime}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </section>
              ) : (
                result?.status !== "running" && (
                  <p>
                    {t(
                      filter
                        ? "comparison.noMatches"
                        : result?.status === "complete"
                          ? "comparison.noDifferences"
                          : "comparison.noConfirmedDifferences",
                    )}
                  </p>
                )
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  {t("previous")}
                </Button>
                <p className="text-sm">
                  {t("page", {
                    page: currentPage + 1,
                    count: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
                  })}
                </p>
                <Button
                  variant="secondary"
                  disabled={(currentPage + 1) * PAGE_SIZE >= rows.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
