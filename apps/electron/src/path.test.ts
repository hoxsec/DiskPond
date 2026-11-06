vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/appData"),
    isPackaged: false,
  },
}));

import {
  corePath,
  globalAccountDirectory,
  globalConfigDirectory,
  globalVaultDirectory,
  platform,
} from "@electron/path";
import { app } from "electron";

const mockedApp = app as typeof app & { isPackaged: boolean };

describe("platform", () => {
  it("is one of win, mac, or linux", () => {
    expect(["win", "mac", "linux"]).toContain(platform);
  });
});

describe("globalConfigDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApp.isPackaged = false;
  });

  it("isolates development settings from BlinkDisk", () => {
    expect(globalConfigDirectory()).toBe(join("/mock/appData", "diskpond-dev"));
  });

  it("uses a separate DiskPond directory in packaged mode", () => {
    mockedApp.isPackaged = true;
    const dir = globalConfigDirectory();
    expect(dir).toBe(join("/mock/appData", "diskpond"));
  });
});

describe("globalVaultDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApp.isPackaged = false;
  });

  it("ends with vaults", () => {
    expect(globalVaultDirectory()).toMatch(/vaults$/);
  });

  it("starts with globalConfigDirectory", () => {
    expect(globalVaultDirectory()).toContain(globalConfigDirectory());
  });
});

describe("globalAccountDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApp.isPackaged = false;
  });

  it("ends with accounts", () => {
    expect(globalAccountDirectory()).toMatch(/accounts$/);
  });
});

describe("corePath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApp.isPackaged = false;
  });

  it("resolves the workspace-built executable instead of a global Go binary", () => {
    const target = coreBuildTarget(process.platform, process.arch);
    expect(corePath()).toContain(
      join("apps", "core", "dist", target.directory, target.executable),
    );
  });
});

describe("core build targets", () => {
  it.each([
    ["win32", "x64", "kopia_windows_amd64", "kopia.exe"],
    ["darwin", "arm64", "kopia_darwin_arm64", "kopia"],
    ["darwin", "x64", "kopia_darwin_amd64", "kopia"],
    ["linux", "x64", "kopia_linux_x64", "kopia"],
    ["linux", "arm64", "kopia_linux_arm64", "kopia"],
    ["linux", "arm", "kopia_linux_armv7l", "kopia"],
  ])("maps %s/%s to its native build output", (os, arch, directory, executable) => {
    expect(coreBuildTarget(os, arch)).toMatchObject({ directory, executable });
  });

  it("rejects unsupported targets instead of selecting a Windows executable", () => {
    expect(() => coreBuildTarget("freebsd", "x64")).toThrow(
      "Unsupported core target",
    );
    expect(() => coreBuildTarget("win32", "ia32")).toThrow(
      "Unsupported core architecture",
    );
  });
});

import { join } from "node:path";
import { coreBuildTarget } from "@diskpond/constants/core";
