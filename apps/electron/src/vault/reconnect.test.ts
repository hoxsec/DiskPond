vi.mock("@electron/vault/fetch", () => ({ fetchVault: vi.fn() }));
vi.mock("node:timers/promises", () => ({ setTimeout: async () => undefined }));

import { fetchVault } from "@electron/vault/fetch";
import { connectRepository } from "@electron/vault/reconnect";
import type { VaultInstance } from "@electron/vault/types";

const kill = vi.fn();
const vault = {
  id: "vlt_fixture",
  status: "STARTING",
  server: { process: { killed: false, exitCode: null, kill } },
} as unknown as VaultInstance;
beforeEach(() => {
  vi.resetAllMocks();
});
it("waits through an asynchronous connect before reporting success", async () => {
  vi.mocked(fetchVault)
    .mockResolvedValueOnce({ connected: false, initTaskID: "connect-task" })
    .mockResolvedValueOnce({ status: "RUNNING" })
    .mockResolvedValueOnce({ connected: true });
  expect(await connectRepository(vault, { password: " exact " })).toEqual({});
  expect(fetchVault).toHaveBeenCalledTimes(3);
});
it.each([
  "FAILED",
  "CANCELED",
])("does not report %s initialization as success", async (status) => {
  vi.mocked(fetchVault)
    .mockResolvedValueOnce({ connected: false, initTaskID: "connect-task" })
    .mockResolvedValueOnce({ status, errorMessage: "Failure" });
  expect(await connectRepository(vault, {})).toEqual({
    code: "CONNECTION_FAILED",
    error: "Failure",
  });
});
it("stops an engine that returns an invalid connection result", async () => {
  vi.mocked(fetchVault).mockResolvedValueOnce(null);
  expect((await connectRepository(vault, {})).code).toBe("CONNECTION_FAILED");
  expect(kill).toHaveBeenCalledOnce();
});
