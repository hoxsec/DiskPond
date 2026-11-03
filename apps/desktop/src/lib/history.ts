import {
  ZHistoryDirectory,
  ZHistorySnapshotList,
  type ZHistorySnapshotType,
  type ZHistorySourceIdentityType,
  ZHistorySourceList,
} from "@blinkdisk/schemas/history";
import { limitHistoryRead } from "@desktop/lib/history-read-limit";
import { isDraftPolicyUserName } from "@desktop/lib/policy-target";
import { vaultApi } from "@desktop/lib/vault";

const HISTORY_READ_TIMEOUT = 30_000;

export function historyKey(
  vaultId: string,
  source: ZHistorySourceIdentityType,
) {
  return [vaultId, source.host, source.userName, source.path];
}

export async function readSnapshotHistory(
  vaultId: string,
  source: ZHistorySourceIdentityType,
  signal: AbortSignal,
) {
  const { data } = await limitHistoryRead(signal, () =>
    vaultApi(vaultId).get("/api/v1/snapshots", {
      params: { ...source, all: "1" },
      signal,
      timeoutMs: HISTORY_READ_TIMEOUT,
    }),
  );
  return ZHistorySnapshotList.parse(data).snapshots.sort(
    (a, b) =>
      Date.parse(b.startTime) - Date.parse(a.startTime) ||
      a.id.localeCompare(b.id),
  );
}

export async function readHistoryDirectory(
  vaultId: string,
  objectId: string,
  signal: AbortSignal,
) {
  const { data } = await limitHistoryRead(signal, () =>
    vaultApi(vaultId).get(`/api/v1/objects/${encodeURIComponent(objectId)}`, {
      signal,
      timeoutMs: HISTORY_READ_TIMEOUT,
    }),
  );
  return (ZHistoryDirectory.parse(data).entries ?? []).map((entry) => ({
    ...entry,
    // DirEntry size/uid/gid use Go omitempty. Unlike the snapshot-list DTO,
    // omission here represents a known zero, including empty files.
    size: entry.type === "d" ? entry.size : (entry.size ?? 0),
    uid: entry.uid ?? 0,
    gid: entry.gid ?? 0,
  }));
}

export async function readHistorySources(vaultId: string, signal: AbortSignal) {
  const { data } = await limitHistoryRead(signal, () =>
    vaultApi(vaultId).get("/api/v1/sources", {
      signal,
      timeoutMs: HISTORY_READ_TIMEOUT,
    }),
  );
  return ZHistorySourceList.parse(data).sources.filter(
    (item) => !isDraftPolicyUserName(item.source.userName),
  );
}

export type SnapshotOutcome =
  | "completed"
  | "partial"
  | "incomplete"
  | "canceled"
  | "unknown";

export function snapshotOutcome(
  snapshot: ZHistorySnapshotType,
): SnapshotOutcome {
  if (snapshot.incomplete === "canceled") return "canceled";
  if (snapshot.incomplete || snapshot.summary?.incomplete) return "incomplete";
  if (!snapshot.rootID || !snapshot.rootEntryType) return "unknown";
  if (!snapshot.summary) return "unknown";
  if (
    snapshot.summary.numFailed > 0 ||
    (snapshot.summary.numIgnoredErrors ?? 0) > 0
  )
    return "partial";
  return "completed";
}

export function formatHistoryTime(value: string | undefined) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      })
    : undefined;
}
