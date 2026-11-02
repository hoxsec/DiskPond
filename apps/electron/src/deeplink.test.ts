const mockApp = vi.hoisted(() => ({
  isPackaged: false,
  setAsDefaultProtocolClient: vi.fn(() => true),
  on: vi.fn(),
}));

vi.mock("@electron/auth", () => ({
  authenticateToken: vi.fn(),
}));

vi.mock("@electron/window", () => ({
  focusWindow: vi.fn(),
  sendWindow: vi.fn(),
}));

vi.mock("electron", () => ({
  app: mockApp,
}));

import { APP_SCHEME } from "@blinkdisk/constants/app";
import { authenticateToken } from "@electron/auth";
import { onDeeplinkOpen } from "@electron/deeplink";
import { sendWindow } from "@electron/window";

beforeEach(() => {
  vi.clearAllMocks();
  mockApp.isPackaged = false;
  mockApp.setAsDefaultProtocolClient.mockReturnValue(true);
});

describe("protocol registration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves the installed handler in unpackaged runs while handling links", async () => {
    const deeplink = await import("@electron/deeplink");

    expect(mockApp.setAsDefaultProtocolClient).not.toHaveBeenCalled();
    await deeplink.onDeeplinkOpen(`${APP_SCHEME}://settings`);
    expect(sendWindow).toHaveBeenCalledWith("deeplink.onOpen", {
      event: "settings",
    });
  });

  it("registers the DiskPond URI scheme in packaged runs", async () => {
    mockApp.isPackaged = true;

    await import("@electron/deeplink");

    expect(mockApp.setAsDefaultProtocolClient).toHaveBeenCalledExactlyOnceWith(
      APP_SCHEME,
    );
  });

  it("reports a failed packaged registration", async () => {
    mockApp.isPackaged = true;
    mockApp.setAsDefaultProtocolClient.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await import("@electron/deeplink");

    expect(warn).toHaveBeenCalledWith(
      `Failed to register ${APP_SCHEME} as default protocol client`,
    );
  });
});

describe("onDeeplinkOpen", () => {
  it("ignores invalid/malformed URLs", async () => {
    await expect(onDeeplinkOpen("not-a-valid-url")).resolves.toBeUndefined();
    expect(sendWindow).not.toHaveBeenCalled();
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it("ignores URLs with wrong protocol", async () => {
    await onDeeplinkOpen("https://example.com");

    expect(sendWindow).not.toHaveBeenCalled();
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it("sends deeplink.onOpen event for valid protocol URL", async () => {
    await onDeeplinkOpen(`${APP_SCHEME}://settings`);

    expect(sendWindow).toHaveBeenCalledWith("deeplink.onOpen", {
      event: "settings",
    });
  });

  it("extracts and authenticates token from auth callback URL", async () => {
    await onDeeplinkOpen(`${APP_SCHEME}://auth/callback#token=mytoken123`);

    expect(sendWindow).toHaveBeenCalledWith("deeplink.onOpen", {
      event: "auth",
    });
    expect(authenticateToken).toHaveBeenCalledWith({ token: "mytoken123" });
  });

  it("does not authenticate when hash doesn't start with #token=", async () => {
    await onDeeplinkOpen(`${APP_SCHEME}://auth/callback#other=value`);

    expect(sendWindow).toHaveBeenCalledWith("deeplink.onOpen", {
      event: "auth",
    });
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it("does not authenticate for non-auth hostnames", async () => {
    await onDeeplinkOpen(`${APP_SCHEME}://settings/callback#token=abc`);

    expect(sendWindow).toHaveBeenCalledWith("deeplink.onOpen", {
      event: "settings",
    });
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it("does not authenticate for non-callback paths", async () => {
    await onDeeplinkOpen(`${APP_SCHEME}://auth/other#token=abc`);

    expect(sendWindow).toHaveBeenCalledWith("deeplink.onOpen", {
      event: "auth",
    });
    expect(authenticateToken).not.toHaveBeenCalled();
  });
});
