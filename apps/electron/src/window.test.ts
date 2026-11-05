const mocks = vi.hoisted(() => ({
  loadURL: vi.fn(),
  openBrowser: vi.fn(),
  handler: undefined as
    | ((details: { url: string }) => { action: string })
    | undefined,
}));
vi.mock("electron", () => ({
  app: { isPackaged: false },
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

import { createWindow } from "@electron/window";

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
