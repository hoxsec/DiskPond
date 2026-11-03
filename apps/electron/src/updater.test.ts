const mocks = vi.hoisted(() => ({
  version: "0.1.0-alpha.3",
  packaged: false,
  enabled: true,
  send: vi.fn(),
  open: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return mocks.packaged;
    },
    getVersion: () => mocks.version,
    whenReady: () => Promise.resolve(),
    once: vi.fn(),
  },
  shell: { openExternal: mocks.open },
}));
vi.mock("@electron/window", () => ({ sendWindow: mocks.send }));
vi.mock("@electron/log", () => ({ log: { warn: vi.fn() } }));
vi.mock("@electron/store", () => ({
  store: { get: () => mocks.enabled, onDidChange: vi.fn() },
}));

function release(version: string, extra = {}) {
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: version.includes("-"),
    ...extra,
  };
}
function respond(versions: ReturnType<typeof release>[], yaml: string) {
  mocks.fetch
    .mockResolvedValueOnce(new Response(JSON.stringify(versions)))
    .mockResolvedValueOnce(new Response(yaml));
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.fetch.mockReset();
  mocks.version = "0.1.0-alpha.3";
  mocks.packaged = false;
  mocks.enabled = true;
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("manually checks latest.yml in development, deduplicates checks and publishes availability", async () => {
  respond(
    [release("0.1.0-alpha.4"), release("0.1.0-alpha.10")],
    "version: 0.1.0-alpha.10\nfiles: []",
  );
  const updater = await import("@electron/updater");
  expect(mocks.fetch).not.toHaveBeenCalled();
  const first = updater.checkForUpdates();
  expect(updater.checkForUpdates()).toBe(first);
  expect(await first).toEqual({ available: true, version: "0.1.0-alpha.10" });
  expect(mocks.fetch.mock.calls[1]?.[0]).toBe(
    "https://github.com/hoxsec/DiskPond/releases/download/v0.1.0-alpha.10/latest.yml",
  );
  expect(mocks.send).toHaveBeenCalledWith(
    "update.available",
    updater.getUpdateStatus(),
  );
  await updater.openUpdateReleases();
  expect(mocks.open).toHaveBeenCalledWith(
    "https://github.com/hoxsec/DiskPond/releases",
  );
});

it.each([
  "0.1.0-alpha.3",
  "0.1.0-alpha.2",
])("does not offer equal or older version %s", async (version) => {
  respond([release(version)], `version: ${version}`);
  const updater = await import("@electron/updater");
  expect((await updater.checkForUpdates()).available).toBe(false);
});

it("filters draft and prereleases for stable installations", async () => {
  mocks.packaged = true;
  mocks.enabled = false;
  mocks.version = "0.1.0";
  respond(
    [
      release("0.3.0", { draft: true }),
      release("0.2.0-beta.1"),
      release("0.1.0"),
    ],
    "version: 0.1.0",
  );
  const updater = await import("@electron/updater");
  expect((await updater.checkForUpdates()).available).toBe(false);
  expect(mocks.fetch.mock.calls[1]?.[0]).toContain("/v0.1.0/latest.yml");
});

it.each([
  "version: [bad",
  "version: 99.0.0",
  "version: invalid",
])("rejects invalid/mismatched metadata and allows retry: %s", async (yaml) => {
  respond([release("0.1.0-alpha.4")], yaml);
  const updater = await import("@electron/updater");
  await expect(updater.checkForUpdates()).rejects.toThrow("Unable to check");
  respond([release("0.1.0-alpha.4")], "version: 0.1.0-alpha.4");
  expect((await updater.checkForUpdates()).available).toBe(true);
});

it("reports HTTP failures without claiming up to date", async () => {
  mocks.fetch.mockResolvedValueOnce(
    new Response("rate limited", { status: 403 }),
  );
  const updater = await import("@electron/updater");
  await expect(updater.checkForUpdates()).rejects.toThrow("Unable to check");
  expect(mocks.send).not.toHaveBeenCalled();
});

it("checks at startup/hourly and respects the automatic opt-out", async () => {
  vi.useFakeTimers();
  mocks.packaged = true;
  respond([release("0.1.0-alpha.4")], "version: 0.1.0-alpha.4");
  await import("@electron/updater");
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  respond([release("0.1.0-alpha.4")], "version: 0.1.0-alpha.4");
  await vi.advanceTimersByTimeAsync(3_600_000);
  expect(mocks.fetch).toHaveBeenCalledTimes(4);
  mocks.enabled = false;
  await vi.advanceTimersByTimeAsync(3_600_000);
  expect(mocks.fetch).toHaveBeenCalledTimes(4);
});
