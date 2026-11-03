import type {
  ZHistoryEntryType,
  ZHistorySnapshotType,
} from "@blinkdisk/schemas/history";
import {
  compareSnapshots,
  comparisonSize,
} from "@desktop/lib/snapshot-comparison";

const time = "2026-11-03T12:00:00Z";
const summary = {
  size: 4,
  files: 1,
  symlinks: 0,
  dirs: 1,
  maxTime: time,
  numFailed: 0,
};
const snapshot = (
  id: string,
  extra: Partial<ZHistorySnapshotType> = {},
): ZHistorySnapshotType => ({
  id,
  rootID: id,
  rootEntryType: "d",
  startTime: time,
  endTime: time,
  description: "",
  retention: [],
  pins: [],
  summary,
  ...extra,
});
const file = (
  name: string,
  obj = name,
  extra: Partial<ZHistoryEntryType> = {},
): ZHistoryEntryType => ({
  name,
  obj,
  type: "f",
  size: 4,
  mtime: time,
  ...extra,
});

function compare(
  objects: Record<string, ZHistoryEntryType[]>,
  before = snapshot("a"),
  after = snapshot("b"),
) {
  const readDirectory = vi.fn(async (id: string) => {
    const entries = objects[id];
    if (!entries) throw new Error("Unavailable");
    return entries;
  });
  return {
    readDirectory,
    result: compareSnapshots({
      before,
      after,
      readDirectory,
      signal: new AbortController().signal,
    }),
  };
}

it("compares exact paths, same-size/mtime edits, metadata-only changes, links and type replacements", async () => {
  const { result, readDirectory } = compare({
    a: [
      file("unchanged"),
      file("edit", "old"),
      file("meta", "meta", { mode: "0644" }),
      file("gone"),
      file("Case"),
      file("雪"),
      file("link", "link-a", { type: "s" }),
      file("replace", "dir-a", { type: "d", summ: summary }),
      file("same-dir", "same", { type: "d", mode: "0755" }),
    ],
    b: [
      file("unchanged"),
      file("edit", "new"),
      file("meta", "meta", { mode: "0600" }),
      file("new"),
      file("case"),
      file("雪"),
      file("link", "link-b", { type: "s" }),
      file("replace", "new-file"),
      file("same-dir", "same", { type: "d", mode: "0700" }),
    ],
    "dir-a": [file("nested")],
  });
  const output = await result;
  expect(output.status).toBe("complete");
  expect(output.rows.map((row) => [row.path.join("/"), row.kind])).toEqual([
    ["", "changed"],
    ["Case", "deleted"],
    ["case", "added"],
    ["edit", "changed"],
    ["gone", "deleted"],
    ["link", "changed"],
    ["meta", "changed"],
    ["new", "added"],
    ["replace", "changed"],
    ["replace/nested", "deleted"],
    ["same-dir", "changed"],
  ]);
  expect(readDirectory.mock.calls.map(([id]) => id)).toEqual([
    "a",
    "b",
    "dir-a",
  ]);
  const replacement = output.rows.find(
    (row) => row.path.join("/") === "replace",
  );
  expect(replacement?.before?.type).toBe("d");
  expect(replacement?.after?.type).toBe("f");
});

it("skips identical directory objects and reverses additions and deletions", async () => {
  const same = compare({}, snapshot("a"), snapshot("b", { rootID: "a" }));
  expect((await same.result).rows).toEqual([]);
  expect(same.readDirectory).not.toHaveBeenCalled();
  const objects = { a: [file("gone")], b: [file("added")] };
  const forward = (await compare(objects).result).rows;
  const reverse = (await compare(objects, snapshot("b"), snapshot("a")).result)
    .rows;
  expect(forward.find((row) => row.path[0] === "gone")?.kind).toBe("deleted");
  expect(reverse.find((row) => row.path[0] === "gone")?.kind).toBe("added");
});

it("never turns missing objects or partial coverage into deletions", async () => {
  const missing = await compare({ a: [file("gone")] }).result;
  expect(missing.status).toBe("partial");
  expect(missing.rows.some((row) => row.kind === "deleted")).toBe(false);
  const partial = await compare(
    { a: [file("gone")], b: [] },
    snapshot("a"),
    snapshot("b", { incomplete: "checkpoint" }),
  ).result;
  expect(partial.rows.find((row) => row.path[0] === "gone")?.kind).toBe(
    "unknown",
  );
  expect(partial.status).toBe("partial");
});

it("keeps root-file metadata unavailable and never reads file or symlink bytes", async () => {
  const { result, readDirectory } = compare(
    {},
    snapshot("a", { rootEntryType: "f", summary: null }),
    snapshot("b", { rootEntryType: "s", summary: null }),
  );
  const output = await result;
  expect(output.status).toBe("partial");
  expect(output.rows[0]?.before?.mtime).toBeUndefined();
  expect(comparisonSize(output.rows[0]?.before)).toBeUndefined();
  expect(readDirectory).not.toHaveBeenCalled();
});

it("bounds large results and permits canceling pending reads", async () => {
  const output = await compareSnapshots({
    before: snapshot("a"),
    after: snapshot("b"),
    signal: new AbortController().signal,
    maxRows: 20,
    readDirectory: async (id) =>
      id === "a" ? [] : Array.from({ length: 1000 }, (_, i) => file(String(i))),
  });
  expect(output.rows).toHaveLength(20);
  expect(output.status).toBe("partial");
  expect(output.issues.some((issue) => issue.reason === "limit")).toBe(true);
  const controller = new AbortController();
  const pending = compareSnapshots({
    before: snapshot("a"),
    after: snapshot("b"),
    signal: controller.signal,
    readDirectory: (_, signal) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      ),
  });
  controller.abort();
  expect((await pending).status).toBe("canceled");
});

it("uses an engine one-file summary for historical root-file size and mtime", async () => {
  const before = snapshot("a", {
    rootEntryType: "f",
    summary: { ...summary, dirs: 0 },
  });
  const after = snapshot("b", {
    rootEntryType: "f",
    rootID: "a",
    summary: { ...summary, dirs: 0, maxTime: "2026-11-03T13:00:00Z" },
  });
  const { result, readDirectory } = compare({}, before, after);
  const output = await result;
  expect(output.rows[0]?.kind).toBe("changed");
  expect(output.rows[0]?.before?.mtime).toBe(time);
  expect(output.rows[0]?.after?.mtime).toBe(after.summary?.maxTime);
  expect(comparisonSize(output.rows[0]?.before)).toBe(4);
  expect(readDirectory).not.toHaveBeenCalled();
});
