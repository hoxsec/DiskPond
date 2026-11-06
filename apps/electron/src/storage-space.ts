import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import {
  type VaultStorageSpace,
  ZVaultStorageSpace,
} from "@diskpond/schemas/storage";

// A disconnected share can block a native filesystem call. Keep it outside
// Electron's main process/thread pool so the deadline can terminate the read.
const probe = `
  const { statfsSync } = require("node:fs");
  try {
    const stats = statfsSync(process.argv[1], { bigint: true });
    const bytes = stats.bavail * stats.bsize;
    const total = stats.blocks * stats.bsize;
    const used = (stats.blocks - stats.bfree) * stats.bsize;
    if (stats.bsize <= 0n || bytes < 0n || used < 0n || used > total ||
        bytes > total - used || total > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error("Invalid capacity");
    process.stdout.write(JSON.stringify({ status: "AVAILABLE", availableBytes: Number(bytes),
      totalBytes: Number(total), usedBytes: Number(used) }));
  } catch {
    process.stdout.write(JSON.stringify({ status: "UNAVAILABLE" }));
  }
`;
const pending = new Map<string, Promise<VaultStorageSpace>>();

export function readStorageSpace(path: string): Promise<VaultStorageSpace> {
  if (!isAbsolute(path) || path.includes("\0"))
    return Promise.resolve({ status: "UNAVAILABLE" });

  const existing = pending.get(path);
  if (existing) return existing;
  if (pending.size >= 2) return Promise.resolve({ status: "UNAVAILABLE" });

  const result = new Promise<VaultStorageSpace>((resolve) => {
    execFile(
      process.execPath,
      ["-e", probe, "--", path],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        timeout: 5_000,
        killSignal: "SIGKILL",
        maxBuffer: 1024,
        windowsHide: true,
        encoding: "utf8",
      },
      (error, stdout) => {
        if (!error) {
          try {
            const value = ZVaultStorageSpace.parse(JSON.parse(stdout));
            resolve(value);
            return;
          } catch {
            // Do not expose native paths or raw child-process diagnostics.
          }
        }
        resolve({ status: "UNAVAILABLE" });
      },
    );
  }).finally(() => pending.delete(path));
  pending.set(path, result);
  return result;
}
