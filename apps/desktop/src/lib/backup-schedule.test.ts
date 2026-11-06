import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import { inspectBackupSchedule } from "@desktop/lib/backup-schedule";

function check(
  schedule: CoreSourceItem["schedule"],
  success: string,
  now: string,
  extra: Partial<CoreSourceItem> = {},
  zone = "UTC",
) {
  return inspectBackupSchedule(
    { status: "IDLE", schedule, ...extra } as CoreSourceItem,
    Date.parse(success),
    Date.parse(now),
    zone,
  ).kind;
}

describe("schedule-aware protection", () => {
  it("does not call a weekly backup overdue after 24 hours", () => {
    expect(
      check(
        { cron: ["0 9 * * MON"] },
        "2026-11-02T09:02:00Z",
        "2026-11-06T12:00:00Z",
      ),
    ).toBe("current");
  });

  it("finds missed runs even when the engine has advanced to a future run", () => {
    expect(
      check(
        { cron: ["0 9 * * *"], runMissed: false },
        "2026-11-04T09:02:00Z",
        "2026-11-06T12:00:00Z",
        { nextSnapshotTime: "2026-11-07T09:00:00Z" },
      ),
    ).toBe("overdue");
  });

  it("uses intervals and allows the scheduling loop a minute to start", () => {
    const schedule = { intervalSeconds: 3600 };
    expect(
      check(schedule, "2026-11-06T09:02:00Z", "2026-11-06T10:00:30Z"),
    ).toBe("current");
    expect(
      check(schedule, "2026-11-06T09:02:00Z", "2026-11-06T10:02:00Z"),
    ).toBe("overdue");
  });

  it("honors manual mode even with inherited scheduling fields", () => {
    expect(
      check(
        { manual: true, intervalSeconds: 600, cron: ["* * * * *"] },
        "2026-01-01T00:00:00Z",
        "2026-11-06T12:00:00Z",
      ),
    ).toBe("manual");
    expect(check({}, "2026-01-01T00:00:00Z", "2026-11-06T12:00:00Z")).toBe(
      "manual",
    );
  });

  it("uses the earliest of several schedule rules", () => {
    expect(
      check(
        { intervalSeconds: 86400, cron: ["0 10 * * *"] },
        "2026-11-06T09:00:00Z",
        "2026-11-06T10:02:00Z",
      ),
    ).toBe("overdue");
  });

  it("recognizes daily times and stripped engine comments", () => {
    for (const schedule of [
      { timeOfDay: [{ hour: 9, min: 0 }] },
      { cron: ["0 9 * * * # morning"] },
    ])
      expect(
        check(schedule, "2026-11-05T09:02:00Z", "2026-11-06T09:02:00Z"),
      ).toBe("overdue");
  });

  it("evaluates local cron times across daylight saving transitions", () => {
    const schedule = { cron: ["0 9 * * *"] };
    expect(
      check(
        schedule,
        "2026-10-31T13:02:00Z",
        "2026-11-01T13:30:00Z",
        {},
        "America/New_York",
      ),
    ).toBe("current");
    expect(
      check(
        schedule,
        "2026-10-31T13:02:00Z",
        "2026-11-01T14:02:00Z",
        {},
        "America/New_York",
      ),
    ).toBe("overdue");
  });

  it("does not reinterpret imported year fields as seconds or guess invalid schedules", () => {
    for (const cron of [
      ["0 9 * * * 2026"],
      ["not a schedule"],
      ["0 9 15W * *"],
    ])
      expect(
        check({ cron }, "2026-11-05T09:00:00Z", "2026-11-06T08:00:00Z"),
      ).toBe("unknown");
  });

  it("does not evaluate another device's schedule in this device's timezone", () => {
    expect(
      check(
        { cron: ["0 9 * * *"] },
        "2026-01-01T00:00:00Z",
        "2026-11-06T12:00:00Z",
        { status: "REMOTE" },
      ),
    ).toBe("manual");
  });
});
