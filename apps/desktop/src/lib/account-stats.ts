import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const ZRepositoryStats = z.object({
  protectedBytes: count,
  protectedFiles: count,
  snapshots: count,
  logicalBytes: count,
  packedBytes: count.nullable(),
  savedBytes: count.nullable(),
});

export function summarizeAccountStats(
  queries: {
    data?: z.infer<typeof ZRepositoryStats> | null;
    isError: boolean;
  }[],
) {
  const available = queries.flatMap((query) =>
    !query.isError && query.data ? [query.data] : [],
  );
  return {
    protectedBytes: available.reduce(
      (sum, stats) => sum + stats.protectedBytes,
      0,
    ),
    protectedFiles: available.reduce(
      (sum, stats) => sum + stats.protectedFiles,
      0,
    ),
    snapshots: available.reduce((sum, stats) => sum + stats.snapshots, 0),
    savedBytes: available.reduce(
      (sum, stats) => sum + (stats.savedBytes ?? 0),
      0,
    ),
    available: available.length,
    savingsAvailable: available.filter((stats) => stats.savedBytes !== null)
      .length,
    total: queries.length,
  };
}
