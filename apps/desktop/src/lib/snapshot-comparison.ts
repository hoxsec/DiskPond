import { snapshotOutcome } from "@desktop/lib/history";
import type {
  ZHistoryEntryType,
  ZHistorySnapshotType,
} from "@diskpond/schemas/history";

export type ComparisonEntry = Partial<ZHistoryEntryType> & { obj: string };
type ComparisonRow = {
  path: string[];
  kind: "added" | "changed" | "deleted" | "unknown";
  before?: ComparisonEntry;
  after?: ComparisonEntry;
};
type ComparisonIssue = {
  path: string[];
  reason: "read" | "coverage" | "metadata" | "limit";
};
export type ComparisonResult = {
  rows: ComparisonRow[];
  issues: ComparisonIssue[];
  visited: number;
  status: "running" | "complete" | "partial" | "canceled";
};

function rootEntry(snapshot: ZHistorySnapshotType): ComparisonEntry {
  const summary = snapshot.summary;
  // Pinned uploadFileWithCheckpointing stores the saved file's exact size and
  // mtime in its one-file summary. Older/checkpoint manifests may omit it.
  const fileSummary =
    snapshot.rootEntryType === "f" &&
    summary?.files === 1 &&
    summary.dirs === 0 &&
    summary.symlinks === 0
      ? summary
      : undefined;
  return {
    obj: snapshot.rootID,
    type: snapshot.rootEntryType ?? undefined,
    summ: snapshot.summary ?? undefined,
    size: fileSummary?.size,
    mtime: fileSummary?.maxTime,
  };
}

function metadataDiffers(a: ComparisonEntry, b: ComparisonEntry) {
  return (
    comparisonSize(a) !== comparisonSize(b) ||
    (["type", "size", "mtime", "mode", "uid", "gid"] as const).some(
      (key) => a[key] !== b[key],
    )
  );
}

export function comparisonSize(entry?: ComparisonEntry) {
  return entry?.type === "d" ? entry.summ?.size : entry?.size;
}

/** Read only snapshot directory objects. Symlinks and files are never opened. */
export async function compareSnapshots({
  before,
  after,
  readDirectory,
  signal,
  onProgress,
  maxRows = 10_000,
  maxEntries = 100_000,
  maxDirectories = 5_000,
}: {
  before: ZHistorySnapshotType;
  after: ZHistorySnapshotType;
  readDirectory: (
    id: string,
    signal: AbortSignal,
  ) => Promise<ZHistoryEntryType[]>;
  signal: AbortSignal;
  onProgress?: (result: ComparisonResult) => void;
  maxRows?: number;
  maxEntries?: number;
  maxDirectories?: number;
}): Promise<ComparisonResult> {
  const result: ComparisonResult = {
    rows: [],
    issues: [],
    visited: 0,
    status: "running",
  };
  const deadline = AbortSignal.timeout(120_000);
  const readSignal = AbortSignal.any([signal, deadline]);
  const issue = (path: string[], reason: ComparisonIssue["reason"]) => {
    if (result.issues.length < 100) result.issues.push({ path, reason });
  };
  const beforeComplete = snapshotOutcome(before) === "completed";
  const afterComplete = snapshotOutcome(after) === "completed";
  if (!beforeComplete || !afterComplete) issue([], "coverage");
  // Root metadata outside the supported one-file summary is unavailable.
  // Never use the current filesystem or a fabricated zero summary instead.
  issue([], "metadata");

  type Pair = {
    path: string[];
    before?: ComparisonEntry;
    after?: ComparisonEntry;
  };
  const queue: Pair[] = [
    { path: [], before: rootEntry(before), after: rootEntry(after) },
  ];
  const reads = new Map<string, Promise<ZHistoryEntryType[]>>();
  let queueIndex = 0;
  let directories = 0;
  let limited = false;
  let progressAt = 0;
  const load = (entry: ComparisonEntry | undefined) => {
    if (entry?.type !== "d") return Promise.resolve<ZHistoryEntryType[]>([]);
    let pending = reads.get(entry.obj);
    if (!pending) {
      if (++directories > maxDirectories) {
        limited = true;
        return Promise.reject(new Error("Comparison limit"));
      }
      pending = readDirectory(entry.obj, readSignal);
      reads.set(entry.obj, pending);
    }
    return pending;
  };

  const visit = async (pair: Pair) => {
    const { path, before: a, after: b } = pair;
    if (readSignal.aborted || limited) return;
    if (++result.visited > maxEntries || path.length > 256) {
      limited = true;
      return;
    }
    if ((a && (!a.type || !a.obj)) || (b && (!b.type || !b.obj))) {
      issue(path, "read");
      return;
    }
    let kind: ComparisonRow["kind"] | undefined;
    if (!a) kind = beforeComplete ? "added" : "unknown";
    else if (!b) kind = afterComplete ? "deleted" : "unknown";
    else if (a.obj !== b.obj || metadataDiffers(a, b)) kind = "changed";
    if (kind) {
      if (result.rows.length >= maxRows) {
        limited = true;
        return;
      }
      result.rows.push({ path, kind, before: a, after: b });
    }
    // Compare the parent metadata before skipping an identical subtree.
    if (a && b && a.obj === b.obj && a.type === b.type) return;
    if (a?.type !== "d" && b?.type !== "d") return;
    const [oldRead, newRead] = await Promise.allSettled([load(a), load(b)]);
    if (oldRead.status === "rejected" || newRead.status === "rejected") {
      if (!readSignal.aborted && !limited) issue(path, "read");
      return;
    }
    const oldEntries = new Map(
      oldRead.value.map((entry) => [entry.name, entry]),
    );
    const newEntries = new Map(
      newRead.value.map((entry) => [entry.name, entry]),
    );
    for (const name of new Set([...oldEntries.keys(), ...newEntries.keys()])) {
      if (queue.length >= maxEntries) {
        limited = true;
        break;
      }
      queue.push({
        path: [...path, name],
        before: oldEntries.get(name),
        after: newEntries.get(name),
      });
    }
  };

  while (queueIndex < queue.length && !readSignal.aborted && !limited) {
    // Two pairs, at most four concurrent reads; yield between batches so even
    // cached large trees remain cancelable from the renderer.
    const batch = queue.slice(queueIndex, queueIndex + 2);
    queueIndex += batch.length;
    await Promise.all(batch.map(visit));
    if (Date.now() - progressAt > 100) {
      onProgress?.({
        ...result,
        rows: [...result.rows],
        issues: [...result.issues],
      });
      progressAt = Date.now();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  if (limited || deadline.aborted) issue([], "limit");
  result.rows.sort((a, b) => {
    for (const [index, x] of a.path.entries()) {
      const y = b.path[index];
      if (y === undefined) return 1;
      if (x !== y) return x < y ? -1 : 1;
    }
    return a.path.length - b.path.length;
  });
  result.status = signal.aborted
    ? "canceled"
    : result.issues.some((item) => item.reason !== "metadata")
      ? "partial"
      : "complete";
  return result;
}
