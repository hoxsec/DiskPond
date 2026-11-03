import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  cancelRestore,
  dismissRestore,
  listRestores,
  restoreDirectory,
} from "@electron/restore";
import { fetchVault } from "@electron/vault/fetch";

vi.mock("@electron/vault/fetch", () => ({ fetchVault: vi.fn() }));
vi.mock("@electron/vault/manage", () => ({
  getVault: () => ({ id: "fixture" }),
}));
vi.mock("@electron/window", () => ({ window: null }));
vi.mock("electron", () => ({ app: {}, dialog: {} }));

const counters = Object.fromEntries(
  [
    "Restored Files",
    "Restored Directories",
    "Restored Symlinks",
    "Ignored Errors",
    "Skipped Files",
  ].map((key) => [key, { value: 0 }]),
);
let destination: string;
let sourceId: string;
let sequence = 0;
beforeEach(async () => {
  destination = await mkdtemp(
    join(process.env.DISKPOND_TEST_TMP || tmpdir(), "restore-outcome-"),
  );
  sourceId = `fixture-${sequence++}`;
  vi.clearAllMocks();
});
afterEach(async () => {
  for (const result of await listRestores({ sourceId }))
    await dismissRestore({ id: result.id });
  await rm(destination, { recursive: true, force: true });
});
function mockTask(terminal: unknown) {
  vi.mocked(fetchVault).mockImplementation(async (_vault, request) => {
    if (request.path.includes("/objects/")) return { entries: null };
    if (request.path === "/api/v1/restore")
      return { id: "task", status: "RUNNING", counters: null };
    return terminal;
  });
}
async function start() {
  await restoreDirectory({
    vaultId: "fixture",
    sourceId,
    objectId: "root",
    options: { type: "UNPACKED", directoryPath: destination, confirmed: false },
  });
}
async function terminal() {
  for (let i = 0; i < 100; i++) {
    const result = (await listRestores({ sourceId }))[0];
    if (result && !["RUNNING", "CANCELING"].includes(result.status))
      return result;
    await delay(10);
  }
  throw new Error("Restore remained active");
}
describe("restore terminal outcomes", () => {
  it.each([
    ["SUCCESS", "COMPLETE"],
    ["FAILED", "FAILED"],
    ["CANCELED", "CANCELED"],
  ])("maps %s only after a terminal response", async (status, expected) => {
    mockTask({ id: "task", status, counters });
    await start();
    const result = await terminal();
    expect(result.status).toBe(expected);
    expect(result.progress === 1).toBe(expected === "COMPLETE");
    expect(await listRestores({ sourceId })).toHaveLength(1);
  });
  it.each([
    undefined,
    {},
    { id: "task", status: "UNKNOWN", counters },
    { id: "other", status: "SUCCESS", counters },
    { id: "task", status: "SUCCESS", counters: {} },
  ])("does not infer success from an unavailable or invalid task", async (response) => {
    mockTask(response);
    await start();
    expect((await terminal()).status).toBe("UNAVAILABLE");
  });
  it.each([
    "Ignored Errors",
    "Skipped Files",
  ])("reports partial for %s", async (counter) => {
    mockTask({
      id: "task",
      status: "SUCCESS",
      counters: { ...counters, [counter]: { value: 2 } },
    });
    await start();
    expect((await terminal()).status).toBe("PARTIAL");
  });
  it.each([
    ["write: no space left on device", "SPACE"],
    ["Access is denied", "PERMISSION"],
  ])("retains actionable failure without exposing raw engine text", async (errorMessage, issue) => {
    mockTask({ id: "task", status: "FAILED", errorMessage, counters });
    await start();
    expect(await terminal()).toMatchObject({ status: "FAILED", issue });
    expect(JSON.stringify(await listRestores({ sourceId }))).not.toContain(
      errorMessage,
    );
  });
  it("keeps CANCELING active until CANCELED is confirmed", async () => {
    let canceled = false;
    let polls = 0;
    vi.mocked(fetchVault).mockImplementation(async (_vault, request) => {
      if (request.path.includes("/objects/")) return { entries: null };
      if (request.path.endsWith("/cancel")) {
        canceled = true;
        return {};
      }
      if (request.path === "/api/v1/restore")
        return { id: "task", status: "RUNNING", counters: null };
      return {
        id: "task",
        status: canceled ? (++polls > 1 ? "CANCELED" : "CANCELING") : "RUNNING",
        counters,
      };
    });
    await start();
    await delay(30);
    const [result] = await listRestores({ sourceId });
    if (!result) throw new Error("No restore");
    await cancelRestore({ id: result.id });
    expect((await listRestores({ sourceId }))[0]?.status).toBe("CANCELING");
    expect((await terminal()).status).toBe("CANCELED");
    expect(canceled).toBe(true);
  });
  it("never writes on unconfirmed overwrite", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(destination, "existing"), "keep");
    mockTask({ id: "task", status: "SUCCESS", counters });
    await start();
    expect(await terminal()).toMatchObject({
      status: "FAILED",
      issue: "CONFIRMATION",
    });
    expect(
      vi
        .mocked(fetchVault)
        .mock.calls.some(([, request]) => request.method === "POST"),
    ).toBe(false);
  });
  it("rejects success when required output is missing", async () => {
    mockTask({ id: "task", status: "SUCCESS", counters });
    vi.mocked(fetchVault).mockImplementation(async (_vault, request) => {
      if (request.path.includes("/objects/"))
        return {
          entries: [{ name: "missing.txt", type: "f", obj: "file", size: 4 }],
        };
      return { id: "task", status: "SUCCESS", counters };
    });
    await start();
    expect(await terminal()).toMatchObject({
      status: "FAILED",
      issue: "DESTINATION",
    });
  });
  it.each([
    "../escape",
    "C:\\escape",
    "file:stream",
    "CON",
    "trailing.",
    "a/b",
  ])("rejects unsafe snapshot name %s before writing", async (name) => {
    vi.mocked(fetchVault).mockResolvedValue({
      entries: [{ name, type: "f", obj: "file" }],
    });
    await start();
    expect((await terminal()).status).toBe("FAILED");
    expect(
      vi
        .mocked(fetchVault)
        .mock.calls.some(([, request]) => request.method === "POST"),
    ).toBe(false);
  });
  it("bounds task polling and requests cancellation without claiming canceled", async () => {
    mockTask({ id: "task", status: "RUNNING", counters });
    const clock = vi.spyOn(Date, "now");
    let time = 0;
    clock.mockImplementation(() => {
      time += 25 * 60 * 60 * 1000;
      return time;
    });
    try {
      await start();
      expect(await terminal()).toMatchObject({
        status: "UNAVAILABLE",
        issue: "TIMEOUT",
      });
      expect(
        vi
          .mocked(fetchVault)
          .mock.calls.some(([, request]) => request.path.endsWith("/cancel")),
      ).toBe(true);
    } finally {
      clock.mockRestore();
    }
  });
});
