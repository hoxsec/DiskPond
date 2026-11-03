vi.mock("@blinkdisk/constants/app", () => ({
  INTERNAL_SCHEME: "app",
  PROTOCOL_API_NS: "api",
  PROTOCOL_FRONTEND_NS: "frontend",
  PROTOCOL_VAULT_NS: "vault",
}));
vi.mock("@electron/vault/fetch", () => ({ fetchVaultRaw: vi.fn() }));
vi.mock("@electron/vault/manage", () => ({
  getVault: vi.fn(() => ({ id: "fixture" })),
}));
vi.mock("electron", () => ({
  app: { isPackaged: false },
  net: { fetch: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));

import path from "node:path";
import { INTERNAL_SCHEME } from "@blinkdisk/constants/app";
import {
  isPathSafe,
  listenProtocol,
  registerProtcol,
  resolveProtocolPath,
} from "@electron/protocol";
import { fetchVaultRaw } from "@electron/vault/fetch";
import { protocol } from "electron";

it.each([
  "create",
  "connect",
  "exists",
  "%63onnect",
  "../repo/connect",
  "connect/",
])("blocks raw credential operations: %s", async (operation) => {
  listenProtocol();
  const handler = vi.mocked(protocol.handle).mock.calls.at(-1)?.[1];
  const response = await handler?.(
    new Request(`app://vault/api/v1/repo/${operation}`, { method: "POST" }),
  );
  expect(response?.status).toBe(403);
  expect(fetchVaultRaw).not.toHaveBeenCalled();
});

it("does not proxy the retired hosted API", async () => {
  listenProtocol();
  const handler = vi.mocked(protocol.handle).mock.calls.at(-1)?.[1];
  expect(handler).toBeDefined();
  const response = await handler?.(new Request("app://api/trpc"));
  expect(response?.status).toBe(404);
});

describe("registerProtcol", () => {
  it("registers the internal scheme as fetch and CORS capable", () => {
    registerProtcol();

    expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          scheme: INTERNAL_SCHEME,
          privileges: expect.objectContaining({
            corsEnabled: true,
            supportFetchAPI: true,
          }),
        }),
      ]),
    );
  });
});

describe("resolveProtocolPath", () => {
  const baseDir = "/srv/frontend";

  it('maps "/" to "index.html" within baseDir', () => {
    const result = resolveProtocolPath(baseDir, "/");
    expect(result).toBe(path.resolve(baseDir, "index.html"));
  });

  it('maps "/app.js" to "app.js" within baseDir', () => {
    const result = resolveProtocolPath(baseDir, "/app.js");
    expect(result).toBe(path.resolve(baseDir, "app.js"));
  });

  it('maps "/assets/style.css" to "assets/style.css" within baseDir', () => {
    const result = resolveProtocolPath(baseDir, "/assets/style.css");
    expect(result).toBe(path.resolve(baseDir, "assets/style.css"));
  });
});

describe("isPathSafe", () => {
  const baseDir = "/srv/frontend";

  it("returns true for paths within baseDir", () => {
    const filePath = path.resolve(baseDir, "index.html");
    expect(isPathSafe(baseDir, filePath)).toBe(true);
  });

  it("returns false for path traversal", () => {
    const filePath = path.resolve(baseDir, "../../etc/passwd");
    expect(isPathSafe(baseDir, filePath)).toBe(false);
  });

  it("returns false for absolute paths outside baseDir", () => {
    expect(isPathSafe(baseDir, "/etc/passwd")).toBe(false);
  });

  it("returns true for nested paths", () => {
    const filePath = path.resolve(baseDir, "assets/js/main.js");
    expect(isPathSafe(baseDir, filePath)).toBe(true);
  });
});

it("forwards renderer cancellation to the authenticated native request", async () => {
  vi.mocked(fetchVaultRaw).mockResolvedValue({ snapshots: [] });
  listenProtocol();
  const handler = vi.mocked(protocol.handle).mock.calls.at(-1)?.[1];
  const controller = new AbortController();
  const request = new Request("app://vault/api/v1/snapshots", {
    signal: controller.signal,
  });
  await handler?.(request);
  const options = vi.mocked(fetchVaultRaw).mock.calls.at(-1)?.[1];
  expect(options?.signal).toBe(request.signal);
  controller.abort();
  expect(options?.signal?.aborted).toBe(true);
});
