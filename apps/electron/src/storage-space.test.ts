import { resolve } from "node:path";
import { readStorageSpace } from "@electron/storage-space";

const mocks = vi.hoisted(() => ({
  execFile:
    vi.fn<
      (
        file: string,
        args: string[],
        options: unknown,
        callback: (error: Error | null, stdout: string) => void,
      ) => void
    >(),
}));
vi.mock("node:child_process", () => ({ execFile: mocks.execFile }));

beforeEach(() => {
  mocks.execFile.mockReset();
});

it("preserves zero available bytes and bounds the native read without a shell", async () => {
  mocks.execFile.mockImplementation((_file, _args, _options, callback) => {
    callback(null, '{"status":"AVAILABLE","availableBytes":0}');
  });
  const path = resolve("fixture & '雪'");
  expect(await readStorageSpace(path)).toEqual({
    status: "AVAILABLE",
    availableBytes: 0,
  });
  expect(mocks.execFile).toHaveBeenCalledWith(
    process.execPath,
    ["-e", expect.any(String), "--", path],
    expect.objectContaining({
      timeout: 5_000,
      killSignal: "SIGKILL",
      maxBuffer: 1024,
      windowsHide: true,
      env: expect.objectContaining({ ELECTRON_RUN_AS_NODE: "1" }),
    }),
    expect.any(Function),
  );
});

it.each([
  "not JSON",
  '{"status":"AVAILABLE","availableBytes":-1}',
  '{"status":"AVAILABLE","availableBytes":1.5}',
  '{"status":"AVAILABLE","availableBytes":9007199254740992}',
  '{"status":"AVAILABLE"}',
])("treats invalid native output as unavailable: %s", async (stdout) => {
  mocks.execFile.mockImplementation((_file, _args, _options, callback) => {
    callback(null, stdout);
  });
  expect(await readStorageSpace(resolve("fixture"))).toEqual({
    status: "UNAVAILABLE",
  });
});

it("discards native failure details and retries after failure", async () => {
  mocks.execFile.mockImplementationOnce((_file, _args, _options, callback) => {
    callback(new Error("Timed out at private-path"), "private-path");
  });
  expect(await readStorageSpace(resolve("fixture"))).toEqual({
    status: "UNAVAILABLE",
  });
  mocks.execFile.mockImplementationOnce((_file, _args, _options, callback) => {
    callback(null, '{"status":"AVAILABLE","availableBytes":4096}');
  });
  expect(await readStorageSpace(resolve("fixture"))).toEqual({
    status: "AVAILABLE",
    availableBytes: 4096,
  });
});

it("shares concurrent reads of a destination and limits outstanding probes", async () => {
  const a = readStorageSpace(resolve("fixture-a"));
  expect(readStorageSpace(resolve("fixture-a"))).toBe(a);
  const b = readStorageSpace(resolve("fixture-b"));
  expect(await readStorageSpace(resolve("fixture-c"))).toEqual({
    status: "UNAVAILABLE",
  });
  expect(mocks.execFile).toHaveBeenCalledTimes(2);
  for (const call of mocks.execFile.mock.calls)
    call[3](null, '{"status":"UNAVAILABLE"}');
  await Promise.all([a, b]);
});

it.each([
  "",
  "relative",
  `${resolve("fixture")}\0`,
])("rejects invalid destination paths before starting a process", async (path) => {
  expect(await readStorageSpace(path)).toEqual({ status: "UNAVAILABLE" });
  expect(mocks.execFile).not.toHaveBeenCalled();
});
