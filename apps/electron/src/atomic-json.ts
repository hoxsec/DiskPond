import { randomUUID } from "node:crypto";
import { renameSync, unlinkSync, writeFileSync } from "node:fs";

// A same-directory rename replaces the old file only after the complete write.
export function writeAtomicJson(filename: string, value: unknown) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value), {
      flag: "wx",
      mode: 0o600,
      flush: true,
    });
    renameSync(temporary, filename);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* Consumed by rename, or retried on the next migration. */
    }
  }
}
