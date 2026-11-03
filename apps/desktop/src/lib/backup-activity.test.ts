import type {
  ZHistorySnapshotType,
  ZHistorySourceType,
} from "@blinkdisk/schemas/history";
import {
  activityMonthDays,
  groupActivityDays,
  localDayKey,
  readActivityHistory,
  shiftActivityMonth,
} from "@desktop/lib/backup-activity";
import { createHistoryReadLimit } from "@desktop/lib/history-read-limit";

const time = "2026-11-03T12:00:00Z";
const source = (userName: string): ZHistorySourceType => ({
  source: { host: "device", userName, path: "C:\\same" },
  status: "IDLE",
});
const snapshot = (
  id: string,
  extra: Partial<ZHistorySnapshotType> = {},
): ZHistorySnapshotType => ({
  id,
  description: "",
  startTime: time,
  endTime: time,
  rootID: "same-root",
  rootEntryType: "d",
  summary: {
    size: 1,
    files: 1,
    dirs: 1,
    symlinks: 0,
    maxTime: time,
    numFailed: 0,
  },
  retention: [],
  pins: [],
  ...extra,
});

it("counts retained IDs (not roots), keeps profile/vault identity, and keeps failures separate", async () => {
  const readers = {
    sources: async () => [
      source("a"),
      {
        ...source("b"),
        lastBackupOutcome: {
          id: "outcome-not-snapshot",
          status: "FAILED" as const,
          startTime: time,
          endTime: time,
        },
      },
    ],
    snapshots: async (_vault: string, identity: { userName: string }) =>
      identity.userName === "a"
        ? [
            snapshot("1"),
            snapshot("2"),
            snapshot("1"),
            snapshot("partial", {
              summary: {
                size: 1,
                files: 1,
                dirs: 1,
                symlinks: 0,
                maxTime: time,
                numFailed: 1,
              },
            }),
            snapshot("canceled", { incomplete: "canceled" }),
            snapshot("file", { rootEntryType: "f", summary: null }),
          ]
        : [snapshot("3")],
  };
  const a = await readActivityHistory(
    "a",
    new AbortController().signal,
    readers,
  );
  const b = await readActivityHistory(
    "b",
    new AbortController().signal,
    readers,
  );
  expect(a.records).toHaveLength(6);
  expect(
    a.records.find((record) => record.snapshot.id === "file")?.outcome,
  ).toBe("unknown");
  expect(a.sources[1]?.lastBackupOutcome?.status).toBe("FAILED");
  expect(
    a.records.some((record) => record.snapshot.id === "outcome-not-snapshot"),
  ).toBe(false);
  expect(
    groupActivityDays([...a.records, ...b.records, ...a.records], "UTC").get(
      "2026-11-03",
    ),
  ).toHaveLength(12);
});

it("isolates unavailable sources and replaces deleted history after a fresh read/restart", async () => {
  let records = [snapshot("old"), snapshot("new")];
  const readers = {
    sources: async () => [source("ok"), source("offline")],
    snapshots: async (_vault: string, identity: { userName: string }) => {
      if (identity.userName === "offline") throw new Error("offline");
      return records;
    },
  };
  const first = await readActivityHistory(
    "v",
    new AbortController().signal,
    readers,
  );
  expect(first.records).toHaveLength(2);
  expect(first.unavailableSources).toEqual([source("offline").source]);
  records = [snapshot("new")];
  const second = await readActivityHistory(
    "v",
    new AbortController().signal,
    readers,
  );
  expect(second.records.map((record) => record.snapshot.id)).toEqual(["new"]);
});

it("groups once by local completion across midnight, offsets and DST fallback", async () => {
  const records = await readActivityHistory("v", new AbortController().signal, {
    sources: async () => [source("a")],
    snapshots: async () => [
      snapshot("midnight", {
        startTime: "2026-11-01T03:55:00Z",
        endTime: "2026-11-01T04:05:00Z",
      }),
      snapshot("first-one", { endTime: "2026-11-01T05:30:00Z" }),
      snapshot("second-one", { endTime: "2026-11-01T06:30:00Z" }),
    ],
  });
  const days = groupActivityDays(records.records, "America/New_York");
  expect(days.size).toBe(1);
  expect(days.get("2026-11-01")).toHaveLength(3);
  expect(localDayKey("2026-03-08T06:59:00Z", "America/New_York")).toBe(
    "2026-03-08",
  );
  expect(localDayKey("2026-03-08T07:01:00Z", "America/New_York")).toBe(
    "2026-03-08",
  );
  expect(localDayKey("2026-12-31T23:30:00Z", "Asia/Tokyo")).toBe("2027-01-01");
});

it("navigates leap days and year/month boundaries without overflow", () => {
  const february = shiftActivityMonth(new Date(2024, 0, 31, 12), 1);
  expect([february.getMonth(), february.getDate()]).toEqual([1, 29]);
  expect(
    activityMonthDays(february).some(
      (date) => date.getMonth() === 1 && date.getDate() === 29,
    ),
  ).toBe(true);
  const january = shiftActivityMonth(new Date(2026, 11, 31, 12), 1);
  expect([
    january.getFullYear(),
    january.getMonth(),
    january.getDate(),
  ]).toEqual([2027, 0, 31]);
});

it("limits overlapping reads globally and cancels queued work before execution", async () => {
  const limit = createHistoryReadLimit(1);
  let finish: (() => void) | undefined;
  const first = limit(
    new AbortController().signal,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await Promise.resolve();
  const controller = new AbortController();
  const work = vi.fn(async () => 2);
  const queued = limit(controller.signal, work);
  controller.abort();
  await expect(queued).rejects.toMatchObject({ name: "AbortError" });
  expect(work).not.toHaveBeenCalled();
  finish?.();
  await first;
  expect(await limit(new AbortController().signal, work)).toBe(2);
});

it("bounds source fanout and does not publish canceled fetches as empty success", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    readActivityHistory("v", controller.signal, {
      sources: async () => [source("a")],
      snapshots: async () => [],
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  const readers = {
    sources: async () =>
      Array.from({ length: 201 }, (_, index) => source(String(index))),
    snapshots: vi.fn(async () => []),
  };
  const result = await readActivityHistory(
    "v",
    new AbortController().signal,
    readers,
  );
  expect(result.limited).toBe(true);
  expect(readers.snapshots).toHaveBeenCalledTimes(200);
});
