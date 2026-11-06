vi.mock("@diskpond/utils/id", () => ({ generateId: vi.fn(() => "mock-id") }));
vi.mock("@diskpond/utils/try-catch", () => ({ tryCatch: vi.fn() }));
vi.mock("@electron/log", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@electron/password", () => ({
  getPasswordCache: vi.fn((): string | null => null),
}));
vi.mock("@electron/path", () => ({
  corePath: vi.fn(),
  globalVaultDirectory: vi.fn(() => "/mock"),
}));
vi.mock("@electron/vault/fetch", () => ({ fetchVault: vi.fn() }));
vi.mock("@electron/vault/manage", () => ({
  vaults: {},
  vaultServerStopped: vi.fn(),
}));
vi.mock("@electron/vault/connection", () => ({
  prepareConnection: vi.fn(
    async (): Promise<
      import("@diskpond/schemas/connection").ManagedStorage | null
    > => null,
  ),
  completeConnectionMigration: vi.fn(),
  rememberConnectionSecrets: vi.fn(),
  redactConnectionError: (_id: string, text: string) => text,
}));
vi.mock("@electron/vault/reconnect", () => ({
  connectRepository: vi.fn(async () => ({})),
}));
vi.mock("@electron/window", () => ({ sendWindow: vi.fn() }));
vi.mock("child_process", () => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("electron", () => ({ app: { isPackaged: false } }));
vi.mock("tough-cookie", () => ({ CookieJar: vi.fn() }));

import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { VAULT_SERVER_START_TIMEOUT_MS } from "@diskpond/constants/vault";
import { tryCatch } from "@diskpond/utils/try-catch";
import { log } from "@electron/log";
import { getPasswordCache } from "@electron/password";
import { prepareConnection } from "@electron/vault/connection";
import { fetchVault } from "@electron/vault/fetch";
import { connectRepository } from "@electron/vault/reconnect";
import {
  calculateStatusPollDelay,
  parseServerLine,
  startVaultServer,
} from "@electron/vault/server";
import { CookieJar } from "tough-cookie";

describe("parseServerLine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses SERVER ADDRESS line", () => {
    const result = parseServerLine("SERVER ADDRESS: https://127.0.0.1:12345");
    expect(result).toEqual({
      key: "SERVER ADDRESS",
      value: "https://127.0.0.1:12345",
    });
  });

  it("parses SERVER PASSWORD line", () => {
    const result = parseServerLine("SERVER PASSWORD: abc123");
    expect(result).toEqual({ key: "SERVER PASSWORD", value: "abc123" });
  });

  it("parses SERVER CONTROL PASSWORD line", () => {
    const result = parseServerLine("SERVER CONTROL PASSWORD: xyz789");
    expect(result).toEqual({ key: "SERVER CONTROL PASSWORD", value: "xyz789" });
  });

  it("parses SERVER CERT SHA256 line", () => {
    const result = parseServerLine("SERVER CERT SHA256: abcdef");
    expect(result).toEqual({ key: "SERVER CERT SHA256", value: "abcdef" });
  });

  it("parses SERVER CERTIFICATE line and decodes base64", () => {
    const encoded = Buffer.from("hello").toString("base64");
    const result = parseServerLine(`SERVER CERTIFICATE: ${encoded}`);
    expect(result).toEqual({
      key: "SERVER CERTIFICATE",
      value: encoded,
      decoded: "hello",
    });
  });

  it("parses BDC SPACE UPDATE line with JSON", () => {
    const result = parseServerLine('BDC SPACE UPDATE: {"used":100}');
    expect(result).toEqual({
      key: "BDC SPACE UPDATE",
      value: '{"used":100}',
      parsed: { used: 100 },
    });
  });

  it("returns BDC VAULT DELETED for vault deleted lines", () => {
    const result = parseServerLine("BDC VAULT DELETED: ");
    expect(result).toEqual({ key: "BDC VAULT DELETED" });
  });

  it("returns NOTIFICATION for notification lines", () => {
    const result = parseServerLine("NOTIFICATION: something");
    expect(result).toEqual({ key: "NOTIFICATION" });
  });

  it("returns null for lines without delimiter", () => {
    const result = parseServerLine("no delimiter here");
    expect(result).toBeNull();
  });

  it("returns unknown for unrecognized keys", () => {
    const line = "SOME OTHER KEY: value";
    const result = parseServerLine(line);
    expect(result).toEqual({ key: "unknown", raw: line });
  });
});

describe("startVaultServer", () => {
  function createMockProcess() {
    // biome-ignore lint/suspicious/noExplicitAny: minimal child process stub
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    proc.exitCode = null;
    proc.killed = false;
    return proc;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(getPasswordCache).mockReturnValue(null);
    vi.mocked(prepareConnection).mockReset().mockResolvedValue(null);
    vi.mocked(connectRepository).mockReset().mockResolvedValue({});
    vi.mocked(fetchVault)
      .mockReset()
      .mockResolvedValue({ connected: false, initTaskID: "" });
    vi.mocked(tryCatch).mockImplementation(
      // biome-ignore lint/suspicious/noExplicitAny: passthrough stub
      (fn: any) => (typeof fn === "function" ? [fn(), undefined] : fn),
    );
    const cookieJarStub = function (this: Record<string, unknown>) {
      this.setCookieSync = vi.fn();
      this.getCookieStringSync = vi.fn();
    };
    vi.mocked(CookieJar).mockImplementation(
      cookieJarStub as unknown as () => CookieJar,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects and kills the process when startup times out", async () => {
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);

    const promise = startVaultServer("test", false);
    const expectation = expect(promise).rejects.toMatchObject({
      code: "VAULT_SERVER_UNAVAILABLE",
    });

    await vi.advanceTimersByTimeAsync(VAULT_SERVER_START_TIMEOUT_MS);
    await expectation;
    expect(proc.kill).toHaveBeenCalled();
  });

  it("rejects when the process fails to spawn", async () => {
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);

    const promise = startVaultServer("test", false);
    const expectation = expect(promise).rejects.toMatchObject({
      code: "VAULT_SERVER_UNAVAILABLE",
    });

    await Promise.resolve();
    proc.emit("error", new Error("spawn ENOENT"));
    await expectation;
  });

  it("rejects when the process exits before it is ready", async () => {
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);

    const promise = startVaultServer("test", false);
    const expectation = expect(promise).rejects.toMatchObject({
      code: "VAULT_SERVER_UNAVAILABLE",
    });

    await Promise.resolve();
    proc.emit("exit", 1);
    await expectation;
  });

  it("resolves once all startup lines are parsed and does not settle again", async () => {
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);

    const promise = startVaultServer("test", false);

    const cert = Buffer.from("certificate").toString("base64");
    await Promise.resolve();
    proc.stderr.emit(
      "data",
      [
        "SERVER ADDRESS: https://127.0.0.1:12345",
        "SERVER PASSWORD: pw",
        "SERVER CONTROL PASSWORD: cpw",
        "SERVER CERT SHA256: hash",
        `SERVER CERTIFICATE: ${cert}`,
        "",
      ].join("\n"),
    );

    const server = await promise;
    expect(server.address).toBe("https://127.0.0.1:12345");
    expect(server.password).toBe("pw");
    proc.stderr.emit("data", "x".repeat(1_048_577));
    expect(log.warn).toHaveBeenCalledWith(
      "Discarded oversized engine status output",
    );

    await vi.advanceTimersByTimeAsync(VAULT_SERVER_START_TIMEOUT_MS);
    proc.emit("exit", 0);
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it.each([
    null,
    "unlocked-password",
  ])("starts managed without a repository password in argv or environment (%s)", async (password) => {
    vi.stubEnv("KOPIA_PASSWORD", "unrelated-inherited-secret");
    vi.mocked(getPasswordCache).mockReturnValueOnce(password);
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    const result = startVaultServer("test", false);
    const failure = expect(result).rejects.toMatchObject({
      code: "VAULT_SERVER_UNAVAILABLE",
    });
    await Promise.resolve();
    const call = vi.mocked(spawn).mock.calls[0];
    if (!call) throw new Error("Engine was not started");
    const [, args, options] = call;
    expect(args).toContain("--no-persist-credentials");
    expect(JSON.stringify(args)).not.toContain("unlocked-password");
    expect(args).toContain("--managed-storage");
    expect(args).toContain("--disable-file-logging");
    expect(args).toContain("--no-persistent-logs");
    expect(options).toMatchObject({ env: { KOPIA_PASSWORD: "" } });
    proc.emit("exit", 1);
    await failure;
    vi.unstubAllEnvs();
  });

  it("buffers split authentication lines and never logs credentials from a mixed chunk", async () => {
    const output = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    const result = startVaultServer("test", false);
    await Promise.resolve();
    proc.stderr.emit("data", "SERVER ADDR");
    proc.stderr.emit(
      "data",
      "ESS: https://127.0.0.1:12345\nSERVER PASSWORD: private-auth\nINFO: diagnostic\nSERVER CONTROL PASS",
    );
    proc.stderr.emit(
      "data",
      `WORD: private-control\nSERVER CERT SHA256: hash\nSERVER CERTIFICATE: ${Buffer.from("certificate").toString("base64")}\n`,
    );
    expect((await result).password).toBe("private-auth");
    const logged = JSON.stringify(output.mock.calls);
    expect(logged).toContain("diagnostic");
    expect(logged).not.toContain("private-auth");
    expect(logged).not.toContain("private-control");
    output.mockRestore();
  });

  it("reconnects with the exact cached password through the authenticated API", async () => {
    vi.mocked(getPasswordCache).mockReturnValue(" exact password 雪 ");
    const storage = {
      type: "webdav" as const,
      config: { url: "https://example.test", password: "provider-secret" },
    };
    vi.mocked(prepareConnection).mockResolvedValue(storage);
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    const result = startVaultServer("test", false);
    await Promise.resolve();
    proc.stderr.emit(
      "data",
      `SERVER ADDRESS: https://127.0.0.1:12345\nSERVER PASSWORD: pw\nSERVER CONTROL PASSWORD: cpw\nSERVER CERT SHA256: hash\nSERVER CERTIFICATE: ${Buffer.from("certificate").toString("base64")}\n`,
    );
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(connectRepository).toHaveBeenCalledWith(expect.anything(), {
      storage,
      password: " exact password 雪 ",
    });
  });

  it.each([
    "transport",
    "repository",
  ])("stops its child if reconnect %s fails", async (failureKind) => {
    vi.mocked(prepareConnection).mockResolvedValue({
      type: "filesystem",
      config: { path: "fixture" },
    });
    vi.mocked(getPasswordCache).mockReturnValue("secret");
    if (failureKind === "transport")
      vi.mocked(connectRepository).mockRejectedValue(new Error("Disconnected"));
    else
      vi.mocked(connectRepository).mockResolvedValue({
        code: "CONNECTION_FAILED",
        error: "Unavailable storage",
      });
    const proc = createMockProcess();
    vi.mocked(spawn).mockReturnValue(proc);
    const result = startVaultServer("test", false);
    const failure = expect(result).rejects.toMatchObject({
      code: "VAULT_SERVER_UNAVAILABLE",
    });
    await Promise.resolve();
    proc.stderr.emit(
      "data",
      `SERVER ADDRESS: https://127.0.0.1:12345\nSERVER PASSWORD: pw\nSERVER CONTROL PASSWORD: cpw\nSERVER CERT SHA256: hash\nSERVER CERTIFICATE: ${Buffer.from("certificate").toString("base64")}\n`,
    );
    await failure;
    expect(proc.kill).toHaveBeenCalled();
  });
});

describe("calculateStatusPollDelay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 100 for iteration 1", () => {
    expect(calculateStatusPollDelay(1)).toBe(100);
  });

  it("returns 500 for iteration 5", () => {
    expect(calculateStatusPollDelay(5)).toBe(500);
  });

  it("returns 900 for iteration 9", () => {
    expect(calculateStatusPollDelay(9)).toBe(900);
  });

  it("returns 1000 for iteration 10", () => {
    expect(calculateStatusPollDelay(10)).toBe(1000);
  });

  it("returns 1000 for iteration 100", () => {
    expect(calculateStatusPollDelay(100)).toBe(1000);
  });
});
