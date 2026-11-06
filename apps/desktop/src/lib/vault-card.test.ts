import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import { inspectBackupHealth } from "@desktop/lib/backup-health";
import { vaultBackupState, vaultLocation } from "@desktop/lib/vault-card";

const now = Date.parse("2026-11-06T12:00:00Z");
const source = (endTime: string, type = "directory") =>
  ({
    type,
    status: "REMOTE",
    lastSnapshot: { endTime, stats: {} },
  }) as CoreSourceItem;

it("uses the latest snapshot time across devices and counts source types accurately", () => {
  const health = inspectBackupHealth(
    [
      source("2026-11-06T11:00:00Z", "file"),
      source("2026-11-04T10:00:00Z"),
      { type: "directory", status: "PENDING" } as CoreSourceItem,
      source("invalid"),
    ],
    now,
  );
  expect(health.latestBackup).toBe("2026-11-06T11:00:00.000Z");
  expect(health.sourceCount).toBe(4);
  expect(health.folderCount).toBe(3);
  expect(health.pending).toBe(true);
  const legacy = source("2026-11-06T11:00:00Z");
  delete (legacy as Partial<CoreSourceItem>).type;
  if (legacy.lastSnapshot)
    legacy.lastSnapshot.rootEntry = { type: "d" } as NonNullable<
      CoreSourceItem["lastSnapshot"]
    >["rootEntry"];
  expect(inspectBackupHealth([legacy], now).folderCount).toBe(1);
});

it("never shows disconnected, failed or partially protected vaults as up to date", () => {
  const health = inspectBackupHealth([source("2026-11-06T11:00:00Z")], now);
  expect(vaultBackupState("RUNNING", health, false, false)).toBe("current");
  expect(vaultBackupState("FAILED", health, false, false)).toBe("offline");
  expect(vaultBackupState("SETUP", health, false, false)).toBe("setup");
  expect(vaultBackupState("RUNNING", health, false, true)).toBe("unavailable");
  expect(vaultBackupState("RUNNING", null, false, false)).toBe("unavailable");
  expect(
    vaultBackupState(
      "RUNNING",
      { ...health, sourcesWithIssues: 1 },
      false,
      false,
    ),
  ).toBe("issues");
  expect(
    vaultBackupState("RUNNING", { ...health, freshSources: 0 }, false, false),
  ).toBe("stale");
  expect(
    vaultBackupState("RUNNING", { ...health, sourceCount: 2 }, false, false),
  ).toBe("stale");
  expect(
    vaultBackupState("RUNNING", inspectBackupHealth([]), false, false),
  ).toBe("new");
  expect(
    vaultBackupState("RUNNING", { ...health, uploading: true }, false, false),
  ).toBe("uploading");
});

it("formats destination summaries for drives, S3 prefixes and remote paths", () => {
  expect(
    vaultLocation({ fields: [{ key: "path", value: "D:\\Backups" }] }),
  ).toBe("D:\\Backups");
  expect(
    vaultLocation({
      fields: [
        { key: "bucket", value: "backup" },
        { key: "prefix", value: "/vault/" },
        { key: "endpoint", value: "https://s3.example.test" },
      ],
    }),
  ).toBe("backup/vault/ · https://s3.example.test");
  expect(
    vaultLocation({
      fields: [
        { key: "host", value: "server" },
        { key: "port", value: 2222 },
        { key: "path", value: "/archive" },
      ],
    }),
  ).toBe("server:2222 · /archive");
  expect(vaultLocation(null)).toBe("");
});
