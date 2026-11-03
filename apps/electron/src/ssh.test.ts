import type { ExecFileException } from "node:child_process";
import { sshKeyscan } from "@electron/ssh";

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  error: null as ExecFileException | null,
  stdout: "example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest\n",
  stderr: "# example.com:22 SSH-2.0-OpenSSH_9.9\n",
}));

vi.mock("node:child_process", () => ({
  execFile: mocks.execFile,
}));

beforeEach(() => {
  mocks.error = null;
  mocks.stdout = "example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest\n";
  mocks.execFile
    .mockReset()
    .mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: unknown,
        callback: (
          error: ExecFileException | null,
          stdout: string,
          stderr: string,
        ) => void,
      ) => callback(mocks.error, mocks.stdout, mocks.stderr),
    );
});

it("accepts keys accompanied by normal OpenSSH stderr banners", async () => {
  expect(await sshKeyscan({ host: "example.com", port: 2222 })).toEqual({
    output: mocks.stdout.trim(),
  });
  expect(mocks.execFile).toHaveBeenCalledExactlyOnceWith(
    "ssh-keyscan",
    ["-T", "10", "-p", "2222", "example.com"],
    expect.objectContaining({ timeout: 30_000, maxBuffer: 200 * 1024 }),
    expect.any(Function),
  );
});

it.each([
  "-f",
  "host,other",
  "host\nother",
  "host other",
  "",
])("rejects invalid host %j before executing a helper", async (host) => {
  expect(await sshKeyscan({ host, port: 22 })).toEqual({
    error: "SCAN_FAILED",
  });
  expect(mocks.execFile).not.toHaveBeenCalled();
});

it.each([
  0,
  65536,
  22.5,
  Number.NaN,
])("rejects invalid port %s", async (port) => {
  expect(await sshKeyscan({ host: "example.com", port })).toEqual({
    error: "SCAN_FAILED",
  });
  expect(mocks.execFile).not.toHaveBeenCalled();
});

it.each([
  "::1",
  "fe80::1%eth0",
  "192.0.2.1",
])("accepts IP host %s", async (host) => {
  expect(await sshKeyscan({ host, port: 22 })).toHaveProperty("output");
});

it("distinguishes an absent helper from scan failures", async () => {
  mocks.error = Object.assign(new Error("missing"), { code: "ENOENT" });
  expect(await sshKeyscan({ host: "example.com", port: 22 })).toEqual({
    error: "KEYSCAN_NOT_INSTALLED",
  });
});

it.each([
  "",
  "# banner only\n",
  " \r\n",
])("rejects empty key output %j", async (stdout) => {
  mocks.stdout = stdout;
  expect(await sshKeyscan({ host: "example.com", port: 22 })).toEqual({
    error: "SCAN_FAILED",
  });
});

it("rejects a failed or timed-out scan even with partial output", async () => {
  mocks.error = Object.assign(new Error("timeout"), { killed: true });
  expect(await sshKeyscan({ host: "example.com", port: 22 })).toEqual({
    error: "SCAN_FAILED",
  });
});
