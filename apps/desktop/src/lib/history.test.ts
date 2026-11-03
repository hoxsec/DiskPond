import { ZHistorySnapshot } from "@blinkdisk/schemas/history";
import {
  historyKey,
  readHistoryDirectory,
  readSnapshotHistory,
  snapshotOutcome,
} from "@desktop/lib/history";

const summary = {
  size: 0,
  files: 0,
  symlinks: 0,
  dirs: 1,
  maxTime: "2026-11-03T12:00:00Z",
  numFailed: 0,
};
afterEach(() => vi.unstubAllGlobals());

it("requests every retained ID with exact source identity, vault and cancellation", async () => {
  const fetch = vi.fn(
    async (_url: URL, _options: RequestInit) =>
      new Response(JSON.stringify({ snapshots: [] })),
  );
  vi.stubGlobal("fetch", fetch);
  const source = {
    host: "other-device",
    userName: "other-user",
    path: "C:\\data\\雪 & files",
  };
  await readSnapshotHistory("vault-a", source, new AbortController().signal);
  const call = fetch.mock.calls[0];
  if (!call) throw new Error("Expected a history request");
  const [url, options] = call;
  expect(url.searchParams.get("all")).toBe("1");
  expect(url.searchParams.get("path")).toBe(source.path);
  expect(url.searchParams.get("host")).toBe(source.host);
  expect(url.searchParams.get("userName")).toBe(source.userName);
  expect(new Headers(options.headers).get("vault-id")).toBe("vault-a");
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(historyKey("vault-a", source)).not.toEqual(
    historyKey("vault-b", source),
  );
});

it("accepts pinned empty-directory null, rejects missing/nonempty entries and preserves known zero-byte files", async () => {
  let payload: unknown = { stream: "kopia:directory", summary, entries: null };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(payload))),
  );
  const read = () =>
    readHistoryDirectory("v", "object", new AbortController().signal);
  expect(await read()).toEqual([]);
  payload = { stream: "kopia:directory", summary };
  await expect(read()).rejects.toThrow();
  payload = {
    stream: "kopia:directory",
    summary: { ...summary, files: 1 },
    entries: null,
  };
  await expect(read()).rejects.toThrow();
  payload = {
    stream: "blinkdisk:directory",
    summary,
    entries: [{ name: "empty", obj: "file", type: "f" }],
  };
  expect((await read())[0]?.size).toBe(0);
});

it("distinguishes partial, canceled, unknown-root and known completed outcomes", () => {
  const snapshot = ZHistorySnapshot.parse({
    id: "1",
    description: "",
    startTime: summary.maxTime,
    endTime: summary.maxTime,
    summary,
    rootID: "dir",
    rootEntryType: "d",
    retention: [],
    pins: [],
  });
  expect(snapshotOutcome(snapshot)).toBe("completed");
  expect(
    snapshotOutcome({ ...snapshot, summary: null, rootEntryType: "f" }),
  ).toBe("unknown");
  expect(
    snapshotOutcome({
      ...snapshot,
      summary: { ...summary, numIgnoredErrors: 1 },
    }),
  ).toBe("partial");
  expect(snapshotOutcome({ ...snapshot, incomplete: "canceled" })).toBe(
    "canceled",
  );
  expect(snapshotOutcome({ ...snapshot, incomplete: "checkpoint" })).toBe(
    "incomplete",
  );
});
