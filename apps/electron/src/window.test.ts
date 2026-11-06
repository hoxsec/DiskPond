const mocks = vi.hoisted(() => ({
  loadURL: vi.fn(),
  openBrowser: vi.fn(),
  quit: vi.fn(),
  get: vi.fn(),
  handler: undefined as
    | ((details: { url: string }) => { action: string })
    | undefined,
}));
vi.mock("electron", () => ({
  app: { isPackaged: false, quit: mocks.quit },
  BrowserWindow: class {
    loadURL = mocks.loadURL;
    setMenu() {}
    webContents = {
      openDevTools() {},
      setWindowOpenHandler(handler: typeof mocks.handler) {
        mocks.handler = handler;
      },
    };
  },
}));
vi.mock("@electron/shell", () => ({ openBrowser: mocks.openBrowser }));
vi.mock("@electron/theme", () => ({ getTheme: () => "light" }));
vi.mock("@electron/store", () => ({ store: { get: mocks.get } }));

import { createWindow, onAllWindowsClosed } from "@electron/window";

afterEach(() => vi.unstubAllEnvs());

it.each([
  undefined,
  "http://127.0.0.1:3002",
])("opens the cloud portal with development origin %s", (desktopUrl) => {
  vi.clearAllMocks();
  vi.stubEnv("DESKTOP_URL", desktopUrl);
  vi.stubEnv("DISKPOND_PREVIEW", "1");
  createWindow();
  mocks.loadURL.mockClear();
  expect(mocks.handler?.({ url: "https://cloud.diskpond.com/" })).toEqual({
    action: "deny",
  });
  expect(mocks.openBrowser).toHaveBeenCalledWith("https://cloud.diskpond.com/");
  expect(mocks.loadURL).not.toHaveBeenCalled();
});

it("keeps background work alive by default and quits only after opting out", () => {
  mocks.quit.mockClear();
  mocks.get.mockReturnValue(undefined);
  onAllWindowsClosed();
  expect(mocks.quit).not.toHaveBeenCalled();

  mocks.get.mockReturnValue(false);
  onAllWindowsClosed();
  expect(mocks.quit).toHaveBeenCalledOnce();

  mocks.quit.mockClear();
  mocks.get.mockReturnValue(true);
  onAllWindowsClosed();
  expect(mocks.quit).not.toHaveBeenCalled();
});
