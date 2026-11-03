import type {
  ZHistorySnapshotType,
  ZHistorySourceIdentityType,
  ZHistorySourceType,
} from "@blinkdisk/schemas/history";
import {
  readHistorySources,
  readSnapshotHistory,
  snapshotOutcome,
} from "@desktop/lib/history";

export type ActivitySnapshot = {
  vaultId: string;
  source: ZHistorySourceIdentityType;
  sourceName?: string;
  snapshot: ZHistorySnapshotType;
  outcome: ReturnType<typeof snapshotOutcome>;
};
export type ActivityHistory = {
  vaultId: string;
  sources: ZHistorySourceType[];
  records: ActivitySnapshot[];
  unavailableSources: ZHistorySourceIdentityType[];
  limited: boolean;
  fetchedAt: string;
};

export async function readActivityHistory(
  vaultId: string,
  signal: AbortSignal,
  readers = { sources: readHistorySources, snapshots: readSnapshotHistory },
): Promise<ActivityHistory> {
  const deadline = AbortSignal.timeout(120_000);
  const readSignal = AbortSignal.any([signal, deadline]);
  const sources = await readers.sources(vaultId, readSignal);
  const result: ActivityHistory = {
    vaultId,
    sources: sources.slice(0, 200),
    records: [],
    unavailableSources: [],
    limited: sources.length > 200,
    fetchedAt: "",
  };
  const seen = new Set<string>();
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < result.sources.length) {
        signal.throwIfAborted();
        const source = result.sources[cursor++];
        if (!source) return;
        if (deadline.aborted || result.records.length >= 20_000) {
          result.limited = true;
          result.unavailableSources.push(source.source);
          continue;
        }
        try {
          const snapshots = await readers.snapshots(
            vaultId,
            source.source,
            readSignal,
          );
          for (const snapshot of snapshots) {
            if (seen.has(snapshot.id)) continue;
            if (result.records.length >= 20_000) {
              result.limited = true;
              break;
            }
            seen.add(snapshot.id);
            result.records.push({
              vaultId,
              source: source.source,
              sourceName: source.name,
              snapshot,
              outcome: snapshotOutcome(snapshot),
            });
          }
        } catch {
          signal.throwIfAborted();
          result.unavailableSources.push(source.source);
          if (deadline.aborted) result.limited = true;
        }
      }
    }),
  );
  result.records.sort(
    (a, b) =>
      Date.parse(a.snapshot.endTime) - Date.parse(b.snapshot.endTime) ||
      a.snapshot.id.localeCompare(b.snapshot.id),
  );
  result.fetchedAt = new Date().toISOString();
  return result;
}

export function localDayKey(value: Date | string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function groupActivityDays(
  records: ActivitySnapshot[],
  timeZone?: string,
) {
  const days = new Map<string, ActivitySnapshot[]>();
  const seen = new Set<string>();
  for (const record of records) {
    const id = JSON.stringify([record.vaultId, record.snapshot.id]);
    if (seen.has(id)) continue;
    seen.add(id);
    const day = localDayKey(record.snapshot.endTime, timeZone);
    const group = days.get(day) ?? [];
    group.push(record);
    days.set(day, group);
  }
  for (const records of days.values())
    records.sort(
      (a, b) => Date.parse(a.snapshot.endTime) - Date.parse(b.snapshot.endTime),
    );
  return days;
}

export function activityMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  return Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), 1 - offset + index, 12),
  );
}

export function shiftActivityMonth(date: Date, delta: number) {
  const last = new Date(
    date.getFullYear(),
    date.getMonth() + delta + 1,
    0,
  ).getDate();
  return new Date(
    date.getFullYear(),
    date.getMonth() + delta,
    Math.min(date.getDate(), last),
    12,
  );
}

export function activitySourceKey(source: ZHistorySourceIdentityType) {
  return JSON.stringify([source.host, source.userName, source.path]);
}
