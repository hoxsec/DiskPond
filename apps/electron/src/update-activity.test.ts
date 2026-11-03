import type { VaultInstance } from "@electron/vault/types";

const mocks = vi.hoisted(() => ({
  restores: vi.fn(),
  starting: vi.fn(),
  fetch: vi.fn(),
  vaults: {} as Record<string, VaultInstance>,
}));
vi.mock("@electron/restore", () => ({ hasActiveRestores: mocks.restores }));
vi.mock("@electron/vault/fetch", () => ({ fetchVault: mocks.fetch }));
vi.mock("@electron/vault/manage", () => ({
  vaults: mocks.vaults,
  hasStartingVaults: mocks.starting,
}));

import { getUpdateActivity } from "@electron/update-activity";

beforeEach(() => {
  vi.resetAllMocks();
  for (const key of Object.keys(mocks.vaults)) delete mocks.vaults[key];
  // The activity reader only uses these identity/state fields, never credentials.
  mocks.vaults.a = { id: "a", status: "RUNNING" } as VaultInstance;
  mocks.restores.mockReturnValue(false);
  mocks.starting.mockReturnValue(false);
});

it("does not treat engines still being spawned as idle", async () => {
  mocks.starting.mockReturnValue(true);
  expect(await getUpdateActivity()).toBe("unknown");
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("checks native restores even when no engine task has started", async () => {
  mocks.restores.mockReturnValue(true);
  expect(await getUpdateActivity()).toBe("busy");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each([
  "RUNNING",
  "CANCELING",
  "UNKNOWN",
])("blocks task status %s", async (status) => {
  mocks.fetch.mockResolvedValue({ tasks: [{ status }] });
  expect(await getUpdateActivity()).toBe("busy");
});
it.each([
  "UPLOADING",
  "PENDING",
  "INITIALIZING",
])("blocks source status %s", async (status) => {
  mocks.fetch
    .mockResolvedValueOnce({ tasks: [] })
    .mockResolvedValueOnce({ sources: [{ status }] });
  expect(await getUpdateActivity()).toBe("busy");
});
it("allows only known inactive sources and terminal tasks", async () => {
  mocks.fetch
    .mockResolvedValueOnce({
      tasks: [
        { status: "SUCCESS" },
        { status: "FAILED" },
        { status: "CANCELED" },
      ],
    })
    .mockResolvedValueOnce({
      sources: [{ status: "IDLE" }, { status: "REMOTE" }],
    });
  expect(await getUpdateActivity()).toBe("idle");
});
it("does not confuse failed activity reads with idle", async () => {
  mocks.fetch.mockRejectedValue(new Error("Offline"));
  expect(await getUpdateActivity()).toBe("unknown");
  mocks.fetch.mockResolvedValue({ code: "NOT_CONNECTED" });
  expect(await getUpdateActivity()).toBe("unknown");
});
it("blocks imminent scheduled work and checks every vault", async () => {
  mocks.vaults.b = { id: "b", status: "RUNNING" } as VaultInstance;
  mocks.fetch.mockImplementation(async (vault, request) =>
    request.path.endsWith("tasks")
      ? { tasks: [] }
      : {
          sources: [
            {
              status: "IDLE",
              nextSnapshotTime: new Date(
                Date.now() + (vault.id === "a" ? 60_000 : 5000),
              ).toISOString(),
            },
          ],
        },
  );
  expect(await getUpdateActivity()).toBe("busy");
});
it("rechecks restores that start while engine reads are pending", async () => {
  mocks.restores.mockReturnValueOnce(false).mockReturnValue(true);
  mocks.fetch
    .mockResolvedValueOnce({ tasks: [] })
    .mockResolvedValueOnce({ sources: [] });
  expect(await getUpdateActivity()).toBe("busy");
});
