import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative();

// These are read-only UI API contracts for the pinned engine, not persisted data.
const ZHistorySourceIdentity = z.object({
  host: z.string().min(1),
  userName: z.string().min(1),
  path: z.string().min(1),
});
export type ZHistorySourceIdentityType = z.infer<typeof ZHistorySourceIdentity>;

const ZHistorySummary = z.object({
  size: count,
  files: count,
  symlinks: count,
  dirs: count,
  maxTime: timestamp,
  incomplete: z.string().optional(),
  numFailed: count,
  numIgnoredErrors: count.optional(),
  errors: z.array(z.object({ path: z.string(), error: z.string() })).optional(),
});

export const ZHistorySnapshot = z.object({
  id: z.string().min(1),
  description: z.string(),
  startTime: timestamp,
  endTime: timestamp,
  incomplete: z.string().optional(),
  summary: ZHistorySummary.nullish(),
  rootID: z.string(),
  rootEntryType: z.enum(["d", "f", "s"]).nullish(),
  retention: z.array(z.string()),
  pins: z.array(z.string()),
});
export type ZHistorySnapshotType = z.infer<typeof ZHistorySnapshot>;

export const ZHistorySnapshotList = z.object({
  snapshots: z.array(ZHistorySnapshot).max(100_000),
});

const ZHistoryEntry = z.object({
  // Names are opaque snapshot segments: preserve case and Unicode, never resolve
  // them against the local filesystem or follow symlinks.
  name: z.string().min(1),
  type: z.enum(["d", "f", "s"]),
  obj: z.string().min(1),
  size: count.optional(),
  mtime: timestamp.optional(),
  mode: z.string().optional(),
  uid: z.number().int().optional(),
  gid: z.number().int().optional(),
  summ: ZHistorySummary.optional(),
});
export type ZHistoryEntryType = z.infer<typeof ZHistoryEntry>;

export const ZHistoryDirectory = z
  .object({
    stream: z.enum(["kopia:directory", "blinkdisk:directory"]),
    summary: ZHistorySummary,
    // Missing entries must be an error, never an empty successful read.
    entries: z.array(ZHistoryEntry).max(100_000).nullable(),
  })
  .superRefine(({ entries, summary }, ctx) => {
    // The pinned Go encoder writes a nil slice as null for an empty directory.
    if (entries === null) {
      if (summary.files || summary.symlinks || summary.dirs > 1)
        ctx.addIssue({
          code: "custom",
          message: "Missing nonempty directory entries",
        });
      return;
    }
    if (new Set(entries.map((entry) => entry.name)).size !== entries.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate snapshot entry names",
      });
  });

const ZHistorySource = z.object({
  source: ZHistorySourceIdentity,
  name: z.string().optional(),
  status: z.string(),
  lastBackupOutcome: z
    .object({
      id: z.string().min(1),
      status: z.enum(["SUCCESS", "PARTIAL", "FAILED"]),
      startTime: timestamp,
      endTime: timestamp,
      errorMessage: z.string().optional(),
      errorCount: count.optional(),
    })
    .optional(),
});
export type ZHistorySourceType = z.infer<typeof ZHistorySource>;
export const ZHistorySourceList = z.object({
  sources: z.array(ZHistorySource).max(10_000),
});
