import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import {
  inspectBackupHealth,
  scoreBackupSetup,
  summarizeBackupHealth,
} from "@desktop/lib/backup-health";

const checked = {
  data: { sourcesWithIssues: 0, sourceCount: 1, freshSources: 1 },
  isPending: false,
  isError: false,
};

describe("backup health", () => {
  it("waits for every vault's initial status", () => {
    expect(
      summarizeBackupHealth([checked, { isPending: true, isError: false }])
        .isLoading,
    ).toBe(true);
  });

  it("keeps failed requests and disconnected vaults from appearing healthy", () => {
    for (const unavailable of [
      { isPending: false, isError: true },
      { ...checked, isError: true },
      { ...checked, data: null },
    ]) {
      expect(summarizeBackupHealth([checked, unavailable])).toEqual({
        sourcesWithIssues: 0,
        isLoading: false,
        isUnavailable: true,
        allFresh: false,
      });
    }
  });

  it("preserves known issues while other vaults are unavailable", () => {
    expect(
      summarizeBackupHealth([
        {
          ...checked,
          data: { ...checked.data, sourcesWithIssues: 2, freshSources: 0 },
        },
        { ...checked, data: null },
      ]),
    ).toEqual({
      sourcesWithIssues: 2,
      isLoading: false,
      isUnavailable: true,
      allFresh: false,
    });
  });

  it("recovers when status checks succeed", () => {
    expect(summarizeBackupHealth([checked])).toEqual({
      sourcesWithIssues: 0,
      isLoading: false,
      isUnavailable: false,
      allFresh: true,
    });
    expect(summarizeBackupHealth([]).isUnavailable).toBe(false);
  });

  it("does not award freshness for empty, incomplete, stale or failed backups", () => {
    const now = Date.parse("2026-11-06T12:00:00Z");
    const source = {
      lastSnapshot: { endTime: "2026-11-06T11:00:00Z", stats: {} },
    } as CoreSourceItem;
    expect(inspectBackupHealth([source], now).freshSources).toBe(1);
    for (const lastSnapshot of [
      undefined,
      { ...source.lastSnapshot, incomplete: "canceled" },
      { ...source.lastSnapshot, endTime: "2026-11-04T11:00:00Z" },
      { ...source.lastSnapshot, endTime: "2026-11-07T11:00:00Z" },
      { ...source.lastSnapshot, stats: { errorCount: 1 } },
    ])
      expect(
        inspectBackupHealth(
          [{ ...source, lastSnapshot } as CoreSourceItem],
          now,
        ).freshSources,
      ).toBe(0);
    expect(
      summarizeBackupHealth([{ ...checked, data: inspectBackupHealth([]) }])
        .allFresh,
    ).toBe(false);
  });

  it("awards 25 points for each setup check, without treating aliases as separate storage", () => {
    const local = {
      id: "a",
      coreId: "repo-a",
      provider: "INTERNAL_DRIVE" as const,
    };
    const remote = {
      id: "b",
      coreId: "repo-b",
      provider: "S3_COMPATIBLE" as const,
    };
    const healthy = summarizeBackupHealth([checked, checked]);
    expect(scoreBackupSetup([local, remote], healthy).score).toBe(100);
    expect(
      scoreBackupSetup([local, remote], { ...healthy, allFresh: false }).score,
    ).toBe(75);
    expect(
      scoreBackupSetup([local, remote], {
        ...healthy,
        isUnavailable: true,
      }).checks.at(-1)?.passed,
    ).toBeNull();
    expect(
      scoreBackupSetup([local, { ...local, id: "alias" }], healthy).score,
    ).toBe(25);
    expect(
      scoreBackupSetup(
        [remote, { ...remote, coreId: "repo-c", provider: "DISKPOND_CLOUD" }],
        healthy,
      ).score,
    ).toBe(75);
    expect(scoreBackupSetup([], summarizeBackupHealth([])).score).toBe(0);
  });
});
