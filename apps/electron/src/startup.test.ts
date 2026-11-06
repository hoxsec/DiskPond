const mocks = vi.hoisted(() => ({
  app: { isPackaged: true },
  values: new Map<string, unknown>(),
  enable: vi.fn(),
  disable: vi.fn(),
  options: vi.fn(),
  set: vi.fn(),
}));

vi.mock("electron", () => ({ app: mocks.app }));
vi.mock("@electron/store", () => ({
  store: {
    get: (key: string) => mocks.values.get(key),
    set: mocks.set,
  },
}));
vi.mock("auto-launch", () => ({
  default: class {
    constructor(options: unknown) {
      mocks.options(options);
    }
    enable = mocks.enable;
    disable = mocks.disable;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.app.isPackaged = true;
  mocks.values.clear();
  mocks.enable.mockResolvedValue(undefined);
  mocks.disable.mockResolvedValue(undefined);
  mocks.set.mockImplementation((key: string, value: unknown) => {
    mocks.values.set(key, value);
  });
});

it("keeps the existing hidden login launch unless the user has opted out", async () => {
  const { initializeStartup } = await import("@electron/startup");
  await initializeStartup();
  expect(mocks.enable).toHaveBeenCalledOnce();
  expect(mocks.options).toHaveBeenCalledWith(
    expect.objectContaining({ isHidden: true }),
  );

  mocks.values.set("preferences.launchAtLogin", false);
  mocks.enable.mockClear();
  await initializeStartup();
  expect(mocks.enable).not.toHaveBeenCalled();
  expect(mocks.disable).toHaveBeenCalledOnce();
  expect(mocks.values.get("preferences.launchAtLogin")).toBe(false);
});

it("finishes an in-flight startup registration before applying an opt-out", async () => {
  const { initializeStartup, setLaunchAtLogin } = await import(
    "@electron/startup"
  );
  let finishRegistration = () => {};
  const registration = new Promise<void>((resolve) => {
    finishRegistration = resolve;
  });
  mocks.enable.mockReturnValueOnce(registration);
  const startup = initializeStartup();
  const optOut = setLaunchAtLogin(false);
  await Promise.resolve();
  expect(mocks.disable).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();

  finishRegistration();
  await Promise.all([startup, optOut]);
  expect(mocks.values.get("preferences.launchAtLogin")).toBe(false);
  expect(mocks.set.mock.calls.map(([, value]) => value)).toEqual([true, false]);
});

it("preserves the saved preference on OS failure and allows retrying", async () => {
  const { setLaunchAtLogin } = await import("@electron/startup");
  mocks.values.set("preferences.launchAtLogin", true);
  mocks.disable.mockRejectedValueOnce(new Error("Access denied"));

  await expect(setLaunchAtLogin(false)).rejects.toThrow("Access denied");
  expect(mocks.values.get("preferences.launchAtLogin")).toBe(true);
  expect(mocks.set).not.toHaveBeenCalled();

  await setLaunchAtLogin(false);
  expect(mocks.values.get("preferences.launchAtLogin")).toBe(false);
});

it("never changes OS startup registration from an unpackaged build", async () => {
  mocks.app.isPackaged = false;
  const { initializeStartup, setLaunchAtLogin } = await import(
    "@electron/startup"
  );
  await initializeStartup();
  await expect(setLaunchAtLogin(false)).rejects.toThrow("installed builds");
  expect(mocks.options).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
