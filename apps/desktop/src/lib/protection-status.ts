import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import { getBackupIssue } from "@desktop/lib/backup-issue";
import { inspectBackupSchedule } from "@desktop/lib/backup-schedule";

export type ProtectionState =
  | "checking"
  | "empty"
  | "setup"
  | "unavailable"
  | "failed"
  | "partial"
  | "incomplete"
  | "overdue"
  | "unprotected"
  | "running"
  | "queued"
  | "paused"
  | "unknown"
  | "remote"
  | "manual"
  | "current";

export type ProtectionVault = {
  id: string;
  name: string;
  status?: string;
  pending: boolean;
  unavailable: boolean;
  sources: CoreSourceItem[];
};

export function latestSourceSuccess(source: CoreSourceItem, now = Date.now()) {
  const snapshot = source.lastSnapshot;
  const outcome = source.lastBackupOutcome;
  const snapshotHasIssues = !!(
    snapshot?.incomplete ||
    snapshot?.rootEntry?.summ?.incomplete ||
    snapshot?.stats?.errorCount ||
    snapshot?.stats?.ignoredErrorCount ||
    snapshot?.rootEntry?.summ?.numFailed ||
    snapshot?.rootEntry?.summ?.numIgnoredErrors
  );
  const candidates: number[] = [];
  if (snapshot?.rootEntry?.obj && !snapshotHasIssues)
    candidates.push(Date.parse(snapshot.endTime));
  const outcomeIncludesSnapshot =
    snapshot &&
    outcome &&
    Date.parse(outcome.startTime) <= Date.parse(snapshot.endTime) &&
    Date.parse(outcome.endTime) >= Date.parse(snapshot.startTime);
  if (
    outcome?.status === "SUCCESS" &&
    !outcome.errorCount &&
    !(snapshotHasIssues && outcomeIncludesSnapshot)
  )
    candidates.push(Date.parse(outcome.endTime));
  return Math.max(0, ...candidates.filter((time) => time > 0 && time <= now));
}

function sourceState(source: CoreSourceItem, now: number): ProtectionState {
  if (source.status === "UPLOADING") return "running";
  if (source.status === "PENDING") return "queued";
  if (source.status === "FAILED") return "failed";
  const issue = getBackupIssue(source);
  if (issue) return issue.kind;
  const snapshot = source.lastSnapshot;
  const success = latestSourceSuccess(source, now);
  if (
    snapshot?.incomplete ||
    snapshot?.rootEntry?.summ?.incomplete ||
    snapshot?.stats?.ignoredErrorCount ||
    snapshot?.rootEntry?.summ?.numIgnoredErrors
  )
    return "incomplete";
  if (source.status === "PAUSED") return "paused";
  if (source.status === "INITIALIZING" || source.status === "STOPPED")
    return "unknown";
  if (!snapshot) return "unprotected";
  if (!success) return "unknown";
  if (source.status === "REMOTE") return "remote";
  return inspectBackupSchedule(source, success, now).kind;
}

const PRIORITY: ProtectionState[] = [
  "failed",
  "partial",
  "incomplete",
  "overdue",
  "unprotected",
  "paused",
  "unknown",
  "running",
  "queued",
  "manual",
  "current",
  "remote",
];

export function summarizeProtection(
  vaults: ProtectionVault[],
  now = Date.now(),
) {
  const available = vaults.filter(
    (vault) =>
      !vault.pending && !vault.unavailable && vault.status === "RUNNING",
  );
  const items = available.flatMap((vault) =>
    vault.sources.map((source) => ({
      vault,
      source,
      state: sourceState(source, now),
    })),
  );
  const localItems = items.filter((item) => item.source.status !== "REMOTE");
  const nextTimes = localItems.flatMap(({ source }) => {
    const time = Date.parse(source.nextSnapshotTime ?? "");
    return !source.schedule?.manual &&
      source.status !== "PAUSED" &&
      Number.isFinite(time) &&
      time > now
      ? [time]
      : [];
  });
  const result = {
    state: "current" as ProtectionState,
    vault: undefined as ProtectionVault | undefined,
    source: undefined as CoreSourceItem | undefined,
    count: localItems.length || items.length,
    lastSuccess: Math.max(
      0,
      ...items.map(({ source }) => latestSourceSuccess(source, now)),
    ),
    nextBackup: nextTimes.length ? Math.min(...nextTimes) : null,
    hasSchedules: localItems.some(
      ({ source }) =>
        !source.schedule?.manual &&
        (!!source.schedule?.intervalSeconds ||
          !!source.schedule?.timeOfDay?.length ||
          !!source.schedule?.cron?.length),
    ),
  };
  const unavailable = vaults.find((vault) => vault.unavailable);
  if (unavailable)
    return { ...result, state: "unavailable" as const, vault: unavailable };
  const setup = vaults.find((vault) => vault.status === "SETUP");
  if (setup) return { ...result, state: "setup" as const, vault: setup };
  if (vaults.some((vault) => vault.pending || vault.status === "STARTING"))
    return { ...result, state: "checking" as const };
  if (!items.length)
    return { ...result, state: "empty" as const, vault: vaults[0] };

  // Remote archives are browsable, but their schedules run on another computer.
  // Never offer to start a remote source or certify its freshness here.
  const candidates = localItems.length ? localItems : items;
  const target = [...candidates].sort(
    (a, b) => PRIORITY.indexOf(a.state) - PRIORITY.indexOf(b.state),
  )[0];
  return target
    ? {
        ...result,
        state: target.state,
        vault: target.vault,
        source: target.source,
      }
    : result;
}

export function protectionAction({
  state,
  source,
  vault,
}: Pick<ReturnType<typeof summarizeProtection>, "state" | "source" | "vault">) {
  switch (state) {
    case "checking":
      return "checking";
    case "unavailable":
      return "checkAgain";
    case "empty":
    case "setup":
      return vault ? "openVault" : "createVault";
    case "overdue":
    case "unprotected":
      return source?.status === "IDLE" ? "backUpNow" : "viewDetails";
    case "partial":
      return getBackupIssue(source) ? "viewFiles" : "viewDetails";
    case "failed":
    case "incomplete":
      return "viewDetails";
    case "unknown":
    case "paused":
      return "viewSchedule";
    case "running":
    case "queued":
      return "viewProgress";
    default:
      return "viewBackups";
  }
}
