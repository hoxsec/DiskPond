const mocks = vi.hoisted(() => ({
  version: "0.1.0-alpha.3",
  packaged: false,
  enabled: true,
  saveError: false,
  send: vi.fn(),
  nativeCheck: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  feed: vi.fn(),
  openExternal: vi.fn(),
  activity: vi.fn(),
  data: new Map<string, unknown>(),
  listeners: new Map<
    string,
    (value: {
      percent: number;
      transferred?: number;
      total?: number;
      bytesPerSecond?: number;
    }) => void
  >(),
  fetch: vi.fn(),
}));
vi.mock("electron", () => ({
  shell: { openExternal: mocks.openExternal },
  app: {
    get isPackaged() {
      return mocks.packaged;
    },
    getVersion: () => mocks.version,
    whenReady: () => Promise.resolve(),
    once: vi.fn(),
  },
}));
vi.mock("electron-updater", () => ({
  default: {
    autoUpdater: {
      on: (event: string, handler: (value: { percent: number }) => void) =>
        mocks.listeners.set(event, handler),
      checkForUpdates: mocks.nativeCheck,
      downloadUpdate: mocks.download,
      quitAndInstall: mocks.install,
      setFeedURL: mocks.feed,
    },
  },
}));
vi.mock("@electron/window", () => ({ sendWindow: mocks.send }));
vi.mock("@electron/log", () => ({ log: { warn: vi.fn() } }));
vi.mock("@electron/store", () => ({
  store: {
    get: (key: string) =>
      key === "preferences.checkForUpdates"
        ? mocks.enabled
        : mocks.data.get(key),
    set: (key: string, value: unknown) => {
      if (mocks.saveError) throw new Error("Disk full");
      mocks.data.set(key, structuredClone(value));
    },
    onDidChange: vi.fn(),
  },
}));
vi.mock("@electron/update-activity", () => ({
  getUpdateActivity: mocks.activity,
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
const originalPlatform = process.platform;
const originalArchitecture = process.arch;
beforeEach(() => {
  Object.defineProperty(process, "platform", { value: "win32" });
  Object.defineProperty(process, "arch", { value: "x64" });
  vi.useFakeTimers();
  vi.resetModules();
  vi.clearAllMocks();
  mocks.fetch.mockReset();
  mocks.nativeCheck.mockReset();
  mocks.download.mockReset();
  mocks.activity.mockReset().mockResolvedValue("idle");
  mocks.data.clear();
  mocks.version = "0.1.0-alpha.3";
  mocks.packaged = false;
  mocks.enabled = true;
  mocks.saveError = false;
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  Object.defineProperty(process, "platform", { value: originalPlatform });
  Object.defineProperty(process, "arch", { value: originalArchitecture });
  vi.unstubAllEnvs();
  vi.clearAllTimers();
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
  expect(await first).toMatchObject({
    available: true,
    version: "0.1.0-alpha.10",
  });
  expect(mocks.fetch.mock.calls[1]?.[0]).toBe(
    "https://github.com/hoxsec/DiskPond/releases/download/v0.1.0-alpha.10/latest.yml",
  );
  expect(mocks.send).toHaveBeenCalledWith(
    "update.available",
    updater.getUpdateStatus(),
  );
});

it("downloads only on request, shares progress and installs only when verified", async () => {
  mocks.packaged = true;
  mocks.enabled = false;
  respond([release("0.1.0")], "version: 0.1.0");
  const updater = await import("@electron/updater");
  await expect(updater.installUpdate()).rejects.toThrow("not ready");
  await updater.checkForUpdates();
  expect(mocks.download).not.toHaveBeenCalled();
  const cancel = vi.fn();
  mocks.nativeCheck.mockResolvedValue({
    updateInfo: { version: "0.1.0" },
    cancellationToken: { cancel },
  });
  let finish!: () => void;
  mocks.download.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const downloading = updater.downloadUpdate();
  expect(updater.downloadUpdate()).toBe(downloading);
  await vi.waitFor(() => expect(mocks.download).toHaveBeenCalled());
  mocks.listeners.get("download-progress")?.({ percent: 42.5 });
  expect(updater.getUpdateStatus()).toMatchObject({
    phase: "downloading",
    progress: 42.5,
  });
  expect(await updater.checkForUpdates()).toMatchObject({
    phase: "downloading",
  });
  await expect(updater.installUpdate()).rejects.toThrow("not ready");
  finish();
  await downloading;
  expect(updater.getUpdateStatus()).toMatchObject({ phase: "ready" });
  expect(mocks.feed).toHaveBeenCalledWith({
    provider: "generic",
    url: "https://github.com/hoxsec/DiskPond/releases/download/v0.1.0/",
  });
  await updater.installUpdate();
  expect(mocks.install).toHaveBeenCalledWith(false, true);
  mocks.listeners.get("error")?.({ percent: 0 });
  expect(updater.getUpdateStatus()).toMatchObject({
    phase: "ready",
    installFailed: true,
  });
  await updater.installUpdate();
  expect(updater.getUpdateStatus().installFailed).toBe(false);
});

it("retains failures and retries without enabling installation", async () => {
  mocks.packaged = true;
  mocks.enabled = false;
  respond([release("0.1.0")], "version: 0.1.0");
  const updater = await import("@electron/updater");
  await updater.checkForUpdates();
  mocks.nativeCheck.mockResolvedValue({
    updateInfo: { version: "0.1.0" },
    cancellationToken: { cancel: vi.fn() },
  });
  mocks.download.mockRejectedValueOnce(new Error("checksum mismatch"));
  await expect(updater.downloadUpdate()).rejects.toThrow("Unable to download");
  expect(updater.getUpdateStatus()).toMatchObject({ phase: "error" });
  await expect(updater.installUpdate()).rejects.toThrow("not ready");
  mocks.download.mockResolvedValueOnce([]);
  await updater.downloadUpdate();
  expect(updater.getUpdateStatus()).toMatchObject({ phase: "ready" });
});

it("rejects changed metadata before downloading", async () => {
  mocks.packaged = true;
  mocks.enabled = false;
  respond([release("0.1.0")], "version: 0.1.0");
  const updater = await import("@electron/updater");
  await updater.checkForUpdates();
  mocks.nativeCheck.mockResolvedValue({ updateInfo: { version: "0.2.0" } });
  await expect(updater.downloadUpdate()).rejects.toThrow("Unable to download");
  expect(mocks.download).not.toHaveBeenCalled();
});

it("keeps development checks read-only", async () => {
  respond([release("0.1.0")], "version: 0.1.0");
  const updater = await import("@electron/updater");
  await updater.checkForUpdates();
  await expect(updater.downloadUpdate()).rejects.toThrow("installed app");
  expect(mocks.nativeCheck).not.toHaveBeenCalled();
});

it.each([
  ["darwin", "x64", "latest-mac.yml", false],
  ["darwin", "arm64", "latest-mac.yml", false],
  ["linux", "x64", "latest-linux.yml", true],
  ["linux", "arm64", "latest-linux-arm64.yml", true],
  ["linux", "arm", "latest-linux-arm.yml", true],
  ["linux", "x64", "latest-linux.yml", false],
])("uses the %s/%s feed and appropriate installation path", async (platform, architecture, metadata, appImage) => {
  Object.defineProperty(process, "platform", { value: platform });
  Object.defineProperty(process, "arch", { value: architecture });
  vi.stubEnv("APPIMAGE", appImage ? "/tmp/DiskPond.AppImage" : undefined);
  mocks.packaged = true;
  mocks.enabled = false;
  respond([release("0.2.0")], "version: 0.2.0");
  const updater = await import("@electron/updater");
  await updater.checkForUpdates();
  expect(mocks.fetch.mock.calls[1]?.[0]).toBe(
    `https://github.com/hoxsec/DiskPond/releases/download/v0.2.0/${metadata}`,
  );
  mocks.nativeCheck.mockResolvedValue({
    updateInfo: { version: "0.2.0" },
    cancellationToken: { cancel: vi.fn() },
  });
  mocks.download.mockResolvedValue([]);
  await updater.downloadUpdate();
  if (appImage) {
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.openExternal).not.toHaveBeenCalled();
    await updater.installUpdate();
    expect(mocks.install).toHaveBeenCalledWith(false, true);
  } else {
    expect(updater.getUpdateStatus().manual).toBe(true);
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://github.com/hoxsec/DiskPond/releases/tag/v0.2.0",
    );
    expect(mocks.nativeCheck).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(updater.getUpdateStatus().history).toEqual([]);
    await expect(updater.installUpdate()).rejects.toThrow("not ready");
  }
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

async function availableUpdate() {
  mocks.packaged = true;
  mocks.enabled = false;
  respond(
    [release("0.1.0", { body: "## Fixes\n<script>alert(1)</script>" })],
    "version: 0.1.0",
  );
  const updater = await import("@electron/updater");
  await updater.checkForUpdates();
  mocks.nativeCheck.mockResolvedValue({
    updateInfo: { version: "0.1.0" },
    cancellationToken: { cancel: vi.fn() },
  });
  mocks.download.mockResolvedValue([]);
  return updater;
}

it("keeps release notes as bounded text tied to the offered version", async () => {
  const updater = await availableUpdate();
  expect(updater.getUpdateStatus().notes).toBe(
    "## Fixes\n<script>alert(1)</script>",
  );
});

it("waits for idle and rechecks at install time without scheduling an automatic restart", async () => {
  const updater = await availableUpdate();
  mocks.activity.mockResolvedValue("busy");
  await updater.downloadUpdate();
  await updater.installUpdate();
  expect(mocks.install).not.toHaveBeenCalled();
  expect(updater.getUpdateStatus().activity).toBe("busy");
  mocks.activity.mockResolvedValue("unknown");
  await updater.installUpdate();
  expect(mocks.install).not.toHaveBeenCalled();
  mocks.activity.mockResolvedValue("idle");
  await vi.advanceTimersByTimeAsync(5000);
  expect(updater.getUpdateStatus().activity).toBe("idle");
  expect(mocks.install).not.toHaveBeenCalled();
  mocks.activity.mockResolvedValue("busy");
  await updater.installUpdate();
  expect(mocks.install).not.toHaveBeenCalled();
  mocks.activity.mockResolvedValue("idle");
  const installing = updater.installUpdate();
  expect(updater.installUpdate()).toBe(installing);
  await installing;
  expect(mocks.install).toHaveBeenCalledTimes(1);
});

it("cancels before native metadata arrives and permits a fresh retry", async () => {
  const updater = await availableUpdate();
  let complete!: (value: unknown) => void;
  mocks.nativeCheck.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const download = updater.downloadUpdate();
  updater.cancelUpdateDownload();
  expect(updater.getUpdateStatus().phase).toBe("canceling");
  const cancel = vi.fn();
  complete({ updateInfo: { version: "0.1.0" }, cancellationToken: { cancel } });
  await download;
  expect(cancel).toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
  expect(updater.getUpdateStatus().phase).toBe("canceled");
  expect(updater.getUpdateStatus().history[0]?.outcome).toBe("CANCELED");
  await updater.downloadUpdate();
  expect(updater.getUpdateStatus().phase).toBe("ready");
  expect(
    updater.getUpdateStatus().history.map((entry) => entry.outcome),
  ).toEqual(["DOWNLOADED", "CANCELED"]);
});

it("cancels a running transfer, suppresses late progress and preserves truthful history", async () => {
  const updater = await availableUpdate();
  let reject!: (error: Error) => void;
  const cancel = vi.fn(() => reject(new Error("Canceled")));
  mocks.nativeCheck.mockResolvedValue({
    updateInfo: { version: "0.1.0" },
    cancellationToken: { cancel },
  });
  mocks.download.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const downloading = updater.downloadUpdate();
  await vi.waitFor(() => expect(mocks.download).toHaveBeenCalled());
  mocks.listeners.get("download-progress")?.({
    percent: 42,
    transferred: 420,
    total: 1000,
    bytesPerSecond: 200,
  });
  expect(updater.getUpdateStatus()).toMatchObject({
    transferred: 420,
    total: 1000,
    bytesPerSecond: 200,
  });
  updater.cancelUpdateDownload();
  mocks.listeners.get("download-progress")?.({ percent: 100 });
  await downloading;
  expect(updater.getUpdateStatus()).toMatchObject({
    phase: "canceled",
    progress: undefined,
  });
  await expect(updater.installUpdate()).rejects.toThrow("not ready");
});

it("treats the download deadline as failure rather than user cancellation", async () => {
  const updater = await availableUpdate();
  let reject!: (error: Error) => void;
  mocks.nativeCheck.mockResolvedValue({
    updateInfo: { version: "0.1.0" },
    cancellationToken: { cancel: () => reject(new Error("Timeout")) },
  });
  mocks.download.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const downloading = updater.downloadUpdate();
  const failure = expect(downloading).rejects.toThrow("Unable to download");
  await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
  await failure;
  expect(updater.getUpdateStatus().history[0]?.outcome).toBe("DOWNLOAD_FAILED");
});

it("reminds after 24 hours, persists over restart and lets manual checks reveal the update", async () => {
  const updater = await availableUpdate();
  updater.remindUpdateLater();
  const until = updater.getUpdateStatus().remindUntil;
  expect(until).toBe(Date.now() + 24 * 60 * 60 * 1000);
  vi.resetModules();
  mocks.enabled = true;
  respond([release("0.1.0")], "version: 0.1.0");
  const restarted = await import("@electron/updater");
  await vi.advanceTimersByTimeAsync(0);
  mocks.enabled = false;
  expect(restarted.getUpdateStatus().remindUntil).toBe(until);
  await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
  expect(restarted.getUpdateStatus().remindUntil).toBeUndefined();
  restarted.remindUpdateLater();
  respond([release("0.1.0")], "version: 0.1.0");
  await restarted.checkForUpdates();
  expect(restarted.getUpdateStatus().remindUntil).toBeUndefined();
});

it("confirms installation only on a matching packaged relaunch", async () => {
  const updater = await availableUpdate();
  await updater.downloadUpdate();
  await updater.installUpdate();
  expect(updater.getUpdateStatus().history[0]?.outcome).toBe("INSTALLING");
  mocks.version = "0.1.0";
  vi.resetModules();
  const restarted = await import("@electron/updater");
  expect(restarted.getUpdateStatus().history[0]?.outcome).toBe("INSTALLED");
  expect(restarted.getUpdateStatus().currentVersion).toBe("0.1.0");
});

it("keeps the app open if installation history cannot be persisted", async () => {
  const updater = await availableUpdate();
  await updater.downloadUpdate();
  mocks.saveError = true;
  await updater.installUpdate();
  expect(mocks.install).not.toHaveBeenCalled();
  expect(updater.getUpdateStatus()).toMatchObject({
    phase: "ready",
    historyUnavailable: true,
    installFailed: true,
  });
  mocks.saveError = false;
  await updater.installUpdate();
  expect(mocks.install).toHaveBeenCalledTimes(1);
});
