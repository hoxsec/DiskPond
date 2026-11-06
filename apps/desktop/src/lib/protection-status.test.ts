import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import {
  latestSourceSuccess,
  type ProtectionVault,
  protectionAction,
  summarizeProtection,
} from "@desktop/lib/protection-status";

const now = Date.parse("2026-11-06T12:00:00Z");

function source(overrides: Partial<CoreSourceItem> = {}): CoreSourceItem {
  return {
    id: "alex@pc:/Documents",
    name: "Documents",
    type: "directory",
    source: { host: "pc", userName: "alex", path: "/Documents" },
    status: "IDLE",
    schedule: { intervalSeconds: 86400 },
    currentTask: "",
    currentTaskStatus: "SUCCESS",
    lastSnapshot: {
      id: "saved",
      startTime: "2026-11-06T09:00:00Z",
      endTime: "2026-11-06T09:02:00Z",
      folder: { host: "pc", userName: "alex", path: "/Documents" },
      description: "",
      stats: {
        totalSize: 1,
        excludedTotalSize: 0,
        fileCount: 1,
        cachedFiles: 0,
        nonCachedFiles: 1,
        dirCount: 1,
        excludedFileCount: 0,
        excludedDirCount: 0,
        ignoredErrorCount: 0,
        errorCount: 0,
      },
      rootEntry: {
        obj: "root",
        name: "Documents",
        type: "d",
        mode: "",
        mtime: "",
        uid: 0,
        gid: 0,
      },
    },
    nextSnapshotTime: "2026-11-07T00:00:00Z",
    ...overrides,
  };
}

function savedSnapshot() {
  const snapshot = source().lastSnapshot;
  if (!snapshot) throw new Error("Missing fixture snapshot");
  return snapshot;
}

function vault(
  sources = [source()],
  overrides: Partial<ProtectionVault> = {},
): ProtectionVault {
  return {
    id: "vault-a",
    name: "Backup disk",
    status: "RUNNING",
    sources,
    pending: false,
    unavailable: false,
    ...overrides,
  };
}

describe("Home protection summary", () => {
  it("handles empty installations and empty vaults without claiming protection", () => {
    const empty = summarizeProtection([], now);
    expect(empty.state).toBe("empty");
    expect(protectionAction(empty)).toBe("createVault");
    expect(protectionAction(summarizeProtection([vault([])], now))).toBe(
      "openVault",
    );
  });

  it("does not let cached successful reads mask a connection failure", () => {
    const model = summarizeProtection(
      [vault(), vault([source()], { id: "offline", unavailable: true })],
      now,
    );
    expect(model.state).toBe("unavailable");
    expect(model.vault?.id).toBe("offline");
    expect(protectionAction(model)).toBe("checkAgain");
  });

  it("waits for all vaults and distinguishes setup from a connection error", () => {
    expect(
      summarizeProtection([vault(), vault([], { pending: true })], now).state,
    ).toBe("checking");
    expect(
      summarizeProtection([vault([], { status: "STARTING" })], now).state,
    ).toBe("checking");
    expect(
      summarizeProtection([vault([], { status: "SETUP" })], now).state,
    ).toBe("setup");
  });

  it("targets the overdue source instead of a different fresh vault", () => {
    const stale = source({
      id: "older",
      lastSnapshot: {
        ...savedSnapshot(),
        endTime: "2026-11-02T09:02:00Z",
      },
    });
    const model = summarizeProtection(
      [vault(), vault([stale], { id: "vault-b" })],
      now,
    );
    expect(model.state).toBe("overdue");
    expect(model.vault?.id).toBe("vault-b");
    expect(model.source?.id).toBe("older");
    expect(protectionAction(model)).toBe("backUpNow");
  });

  it("uses the earliest upcoming local run across vaults", () => {
    const model = summarizeProtection(
      [
        vault([
          source({ nextSnapshotTime: "2026-11-06T14:00:00Z" }),
          source({
            id: "remote",
            status: "REMOTE",
            nextSnapshotTime: "2026-11-06T12:30:00Z",
          }),
        ]),
        vault([source({ nextSnapshotTime: "2026-11-06T13:00:00Z" })], {
          id: "vault-b",
        }),
      ],
      now,
    );
    expect(model.nextBackup).toBe(Date.parse("2026-11-06T13:00:00Z"));
    expect(model.count).toBe(2);
  });

  it("does not label manual or remote backups up to date", () => {
    expect(
      summarizeProtection(
        [vault([source({ schedule: { manual: true } })])],
        now,
      ).state,
    ).toBe("manual");
    expect(
      summarizeProtection([vault([source({ status: "REMOTE" })])], now).state,
    ).toBe("remote");
    const remote = summarizeProtection(
      [vault([source({ status: "REMOTE", lastSnapshot: undefined })])],
      now,
    );
    expect(protectionAction(remote)).toBe("viewDetails");
  });

  it("shows active work ahead of its previous failure, but preserves other sources' issues", () => {
    const failed = source({
      lastBackupOutcome: {
        id: "failed",
        status: "FAILED",
        startTime: "2026-11-06T10:00:00Z",
        endTime: "2026-11-06T10:01:00Z",
      },
    });
    for (const [status, expected] of [
      ["UPLOADING", "running"],
      ["PENDING", "queued"],
    ] as const) {
      expect(
        summarizeProtection([vault([{ ...failed, status }])], now).state,
      ).toBe(expected);
      expect(
        summarizeProtection(
          [
            vault([
              { ...failed, status },
              { ...failed, id: "other" },
            ]),
          ],
          now,
        ).state,
      ).toBe("failed");
    }
  });

  it("keeps partial, canceled, ignored-error and missing backups from going green", () => {
    const snapshot = savedSnapshot();
    for (const [lastSnapshot, expected] of [
      [{ ...snapshot, stats: { ...snapshot.stats, errorCount: 2 } }, "partial"],
      [{ ...snapshot, incomplete: "canceled" }, "incomplete"],
      [
        { ...snapshot, stats: { ...snapshot.stats, ignoredErrorCount: 1 } },
        "incomplete",
      ],
      [undefined, "unprotected"],
    ] as const) {
      expect(
        summarizeProtection([vault([source({ lastSnapshot })])], now).state,
      ).toBe(expected);
    }
  });

  it("does not count a failed attempt as the last successful backup", () => {
    const failed = source({
      lastBackupOutcome: {
        id: "failed",
        status: "FAILED",
        startTime: "2026-11-06T11:00:00Z",
        endTime: "2026-11-06T11:01:00Z",
      },
    });
    expect(latestSourceSuccess(failed, now)).toBe(
      Date.parse("2026-11-06T09:02:00Z"),
    );
    if (!failed.lastBackupOutcome) throw new Error("Missing fixture outcome");
    const success = {
      ...failed,
      lastBackupOutcome: {
        ...failed.lastBackupOutcome,
        status: "SUCCESS" as const,
      },
    };
    expect(latestSourceSuccess(success, now)).toBe(
      Date.parse("2026-11-06T11:01:00Z"),
    );
    expect(
      summarizeProtection(
        [vault([{ ...success, lastSnapshot: undefined }])],
        now,
      ).state,
    ).toBe("unprotected");
  });

  it("does not certify ignored file errors just because the engine task succeeded", () => {
    const snapshot = savedSnapshot();
    const item = source({
      lastSnapshot: {
        ...snapshot,
        stats: { ...snapshot.stats, ignoredErrorCount: 1 },
      },
      lastBackupOutcome: {
        id: "ignored-error-run",
        status: "SUCCESS",
        startTime: snapshot.startTime,
        endTime: snapshot.endTime,
      },
    });
    expect(latestSourceSuccess(item, now)).toBe(0);
    expect(summarizeProtection([vault([item])], now).state).toBe("incomplete");
  });

  it("rejects future or corrupt snapshot timestamps and unknown scheduling state", () => {
    for (const endTime of ["invalid", "2027-01-01T00:00:00Z"])
      expect(
        summarizeProtection(
          [vault([source({ lastSnapshot: { ...savedSnapshot(), endTime } })])],
          now,
        ).state,
      ).toBe("unknown");
    expect(
      summarizeProtection(
        [vault([source({ schedule: { cron: ["invalid"] } })])],
        now,
      ).state,
    ).toBe("unknown");
    expect(
      summarizeProtection([vault([source({ status: "PAUSED" })])], now)
        .nextBackup,
    ).toBeNull();
  });
});
