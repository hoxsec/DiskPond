import { historyKey, readHistoryDirectory } from "@desktop/lib/history";
import {
  type ComparisonResult,
  compareSnapshots,
} from "@desktop/lib/snapshot-comparison";
import type {
  ZHistoryEntryType,
  ZHistorySnapshotType,
  ZHistorySourceIdentityType,
} from "@diskpond/schemas/history";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export function useSnapshotComparison(
  vaultId: string,
  source: ZHistorySourceIdentityType,
  before?: ZHistorySnapshotType,
  after?: ZHistorySnapshotType,
) {
  const client = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  const [result, setResult] = useState<ComparisonResult>();
  const [run, setRun] = useState(0);
  useEffect(() => {
    // run is an explicit retry generation, including retries of the same pair.
    void run;
    const abort = new AbortController();
    controller.current = abort;
    let active = true;
    setResult(undefined);
    if (before && after && before.id !== after.id) {
      setResult({ rows: [], issues: [], visited: 0, status: "running" });
      compareSnapshots({
        before,
        after,
        signal: abort.signal,
        readDirectory: async (id, signal) => {
          const key = ["history-directory", ...historyKey(vaultId, source), id];
          const cached = client.getQueryData<ZHistoryEntryType[]>(key);
          if (cached) return cached;
          const entries = await readHistoryDirectory(vaultId, id, signal);
          if (!signal.aborted) client.setQueryData(key, entries);
          return entries;
        },
        onProgress: (next) => {
          if (active) setResult(next);
        },
      })
        .then((next) => {
          if (active) setResult(next);
        })
        .catch(() => {
          if (active)
            setResult({
              rows: [],
              issues: [{ path: [], reason: "read" }],
              visited: 0,
              status: abort.signal.aborted ? "canceled" : "partial",
            });
        });
    }
    return () => {
      active = false;
      abort.abort();
    };
  }, [vaultId, source, before, after, client, run]);
  return {
    result,
    cancel: () => controller.current?.abort(),
    retry: () => setRun((value) => value + 1),
  };
}
