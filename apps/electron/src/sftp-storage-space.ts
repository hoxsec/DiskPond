import { createHmac, timingSafeEqual } from "node:crypto";
import type { VaultStorageSpace } from "@diskpond/schemas/storage";
import { Client } from "ssh2";
import { z } from "zod";

const ZConfig = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  path: z.string().min(1).max(4096),
  password: z.string().optional(),
  keyData: z.string().optional(),
  knownHostsData: z.string().min(1).max(10000),
  externalSSH: z.boolean().optional(),
});
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ZStats = z.object({
  f_frsize: integer.positive(),
  f_bavail: integer,
  f_blocks: integer,
  f_bfree: integer,
});
const pending = new Map<string, Promise<VaultStorageSpace>>();

function sameBytes(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function matchesHost(pattern: string, host: string) {
  if (pattern.startsWith("|1|")) {
    const [, , salt, hash] = pattern.split("|");
    if (!salt || !hash) return false;
    return sameBytes(
      createHmac("sha1", Buffer.from(salt, "base64")).update(host).digest(),
      Buffer.from(hash, "base64"),
    );
  }
  const expression = pattern
    .split("")
    .map((character) => {
      if (character === "*") return ".*";
      if (character === "?") return ".";
      return character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(`^${expression}$`, "i").test(host);
}

// Never accept an unknown/changed key or fetch a replacement automatically.
// CA host certificates are not supported by this probe; fail closed for them.
export function verifySftpHostKey(
  data: string,
  host: string,
  port: number,
  key: Buffer,
) {
  const hostname = host.replace(/^\[|\]$/g, "");
  const address = port === 22 ? hostname : `[${hostname}]:${port}`;
  let trusted = false;
  for (const line of data.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (!fields[0] || fields[0].startsWith("#")) continue;
    const marker = fields[0].startsWith("@") ? fields.shift() : undefined;
    const [hosts, type, encoded] = fields;
    if (!hosts || !type || !encoded) return false;
    const saved = Buffer.from(encoded, "base64");
    // Revoked keys must not become trusted via another matching entry.
    if (marker === "@revoked" && sameBytes(saved, key)) return false;
    if (marker) continue;
    const patterns = hosts.split(",");
    if (
      patterns.some(
        (pattern) =>
          pattern.startsWith("!") && matchesHost(pattern.slice(1), address),
      )
    )
      continue;
    if (
      !patterns.some(
        (pattern) => !pattern.startsWith("!") && matchesHost(pattern, address),
      )
    )
      continue;
    if (saved.length < 4) continue;
    const typeLength = saved.readUInt32BE(0);
    if (
      typeLength > saved.length - 4 ||
      saved.subarray(4, 4 + typeLength).toString() !== type
    )
      continue;
    if (sameBytes(saved, key)) trusted = true;
  }
  return trusted;
}

export async function readSftpStorageSpace(
  config: Record<string, unknown>,
): Promise<VaultStorageSpace> {
  const parsed = ZConfig.safeParse(config);
  if (!parsed.success) return { status: "UNAVAILABLE" };
  const value = parsed.data;
  if (value.externalSSH) return { status: "UNSUPPORTED" };
  if (!value.password && !value.keyData) return { status: "UNAVAILABLE" };
  const key = JSON.stringify(value);
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 4) return { status: "UNAVAILABLE" };

  const result = new Promise<VaultStorageSpace>((resolve) => {
    const client = new Client();
    let finished = false;
    const finish = (space: VaultStorageSpace) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      client.destroy();
      resolve(space);
    };
    const timer = setTimeout(() => finish({ status: "UNAVAILABLE" }), 5000);
    client.on("error", () => finish({ status: "UNAVAILABLE" }));
    client.on("close", () => finish({ status: "UNAVAILABLE" }));
    client.on("ready", () => {
      client.sftp((error, sftp) => {
        if (finished) return;
        if (error) return finish({ status: "UNAVAILABLE" });
        sftp.on("error", () => finish({ status: "UNAVAILABLE" }));
        sftp.on("close", () => finish({ status: "UNAVAILABLE" }));
        try {
          sftp.ext_openssh_statvfs(value.path, (error, stats: unknown) => {
            if (error) {
              const unsupported = z
                .object({ code: z.literal(8) })
                .safeParse(error).success;
              finish({ status: unsupported ? "UNSUPPORTED" : "UNAVAILABLE" });
              return;
            }
            const parsed = ZStats.safeParse(stats);
            if (!parsed.success) return finish({ status: "UNAVAILABLE" });
            const { f_frsize, f_bavail, f_blocks, f_bfree } = parsed.data;
            const bytes = BigInt(f_frsize) * BigInt(f_bavail);
            const total = BigInt(f_frsize) * BigInt(f_blocks);
            const used =
              BigInt(f_frsize) * (BigInt(f_blocks) - BigInt(f_bfree));
            finish(
              used >= 0n &&
                used <= total &&
                bytes <= total - used &&
                total <= BigInt(Number.MAX_SAFE_INTEGER)
                ? {
                    status: "AVAILABLE",
                    availableBytes: Number(bytes),
                    totalBytes: Number(total),
                    usedBytes: Number(used),
                  }
                : { status: "UNAVAILABLE" },
            );
          });
        } catch (error) {
          finish({
            status:
              error instanceof Error &&
              error.message === "Server does not support this extended request"
                ? "UNSUPPORTED"
                : "UNAVAILABLE",
          });
        }
      });
    });
    try {
      client.connect({
        host: value.host.replace(/^\[|\]$/g, ""),
        port: value.port,
        username: value.username,
        // Match the engine: password takes precedence over private key.
        ...(value.password
          ? { password: value.password }
          : { privateKey: value.keyData }),
        hostVerifier: (key: Buffer) =>
          verifySftpHostKey(value.knownHostsData, value.host, value.port, key),
        readyTimeout: 5000,
        tryKeyboard: false,
      });
    } catch {
      finish({ status: "UNAVAILABLE" });
    }
  });
  pending.set(key, result);
  try {
    return await result;
  } finally {
    pending.delete(key);
  }
}
