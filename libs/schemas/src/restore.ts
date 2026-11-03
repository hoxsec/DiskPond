import { z } from "zod";
import { ZRestoreDirectory } from "./directory";

const id = z.string().min(1).max(4096);
export const ZRestoreItem = z.object({
  objectId: id,
  entryPath: id.optional(),
  snapshotId: id.optional(),
  name: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (name) =>
        !/[\\/:<>"|?*]/.test(name) &&
        !Array.from(name).some((character) => character.charCodeAt(0) < 32) &&
        name !== "." &&
        name !== ".." &&
        !/[. ]$/.test(name) &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name),
      "Invalid restore item name",
    ),
  type: z.enum(["FILE", "SYMLINK", "DIRECTORY"]),
});
const context = z.object({ vaultId: id, sourceId: id });
export const ZRestoreSingle = context.extend({
  item: ZRestoreItem,
  dialogTitle: id,
});
export const ZRestoreMultiple = context.extend({
  items: z.array(ZRestoreItem).min(1).max(10000),
  dialogTitle: id,
});
export const ZRestoreFolder = context.extend({
  objectId: id,
  options: ZRestoreDirectory,
});
export const ZRestoreList = z.object({ sourceId: id });
export const ZRestoreAction = z.object({ id });
export const ZRestoreCheckEmpty = z.object({ directoryPath: id });

export const ZRestoreTask = z.object({
  id,
  status: z.enum(["RUNNING", "CANCELING", "CANCELED", "SUCCESS", "FAILED"]),
  errorMessage: z.string().optional(),
  counters: z
    .record(z.string(), z.object({ value: z.number().finite().nonnegative() }))
    .nullable(),
});

export const ZRestoreResult = z.object({
  id,
  sourceId: id,
  destination: id,
  objects: z.array(id),
  status: z.enum([
    "RUNNING",
    "CANCELING",
    "COMPLETE",
    "PARTIAL",
    "FAILED",
    "CANCELED",
    "UNAVAILABLE",
  ]),
  progress: z.number().min(0).max(1),
  restored: z.number(),
  skipped: z.number(),
  errors: z.number(),
  issue: z
    .enum([
      "DESTINATION",
      "ENGINE",
      "TASK",
      "TIMEOUT",
      "LINK",
      "CONFIRMATION",
      "ZIP",
      "SPACE",
      "PERMISSION",
    ])
    .optional(),
});
export type ZRestoreResultType = z.infer<typeof ZRestoreResult>;
