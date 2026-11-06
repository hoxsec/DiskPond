import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { VaultStorageSpace } from "@blinkdisk/schemas/storage";
import { sign } from "aws4";
import { z } from "zod";

const ZConfig = z.object({
  endpoint: z.string().min(1),
  bucket: z.string().min(1),
  accessKeyID: z.string().min(1),
  secretAccessKey: z.string().min(1),
  sessionToken: z.string().optional(),
  region: z.string().optional(),
  doNotUseTLS: z.boolean().optional(),
  doNotVerifyTLS: z.boolean().optional(),
});
const bytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ZQuota = z.object({
  bucket: z.string(),
  quota_limit: bytes.nullable(),
  current_usage: bytes.nullable(),
  remaining_quota: bytes.nullable(),
});
const pending = new Map<string, Promise<VaultStorageSpace>>();

// Probe only the saved S3 origin. No redirects, repository listing, or writes.
export async function readS3StorageSpace(
  config: Record<string, unknown>,
): Promise<VaultStorageSpace> {
  const parsed = ZConfig.safeParse(config);
  if (!parsed.success) return { status: "UNSUPPORTED" };
  const value = parsed.data;
  let url: URL;
  try {
    url = new URL(
      value.endpoint.includes("://")
        ? value.endpoint
        : `${value.doNotUseTLS ? "http" : "https"}://${value.endpoint}`,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (url.protocol === "http:" && !value.doNotUseTLS) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    )
      return { status: "UNAVAILABLE" };
  } catch {
    return { status: "UNAVAILABLE" };
  }
  // AWS has no bucket byte quota; do not send RustFS admin probes there.
  if (/(^|\.)amazonaws\.com(\.cn)?$/.test(url.hostname))
    return { status: "UNSUPPORTED" };

  url.pathname = `/rustfs/admin/v3/quota-stats/${encodeURIComponent(value.bucket)}`;
  const key = JSON.stringify(value);
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 4) return { status: "UNAVAILABLE" };

  const promise = new Promise<VaultStorageSpace>((resolve) => {
    const options = sign(
      {
        service: "s3",
        region: value.region || "us-east-1",
        host: url.host,
        path: url.pathname,
        method: "GET",
      },
      {
        accessKeyId: value.accessKeyID,
        secretAccessKey: value.secretAccessKey,
        sessionToken: value.sessionToken,
      },
    );
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        method: "GET",
        headers: options.headers,
        rejectUnauthorized: !value.doNotVerifyTLS,
      },
    );
    const timer = setTimeout(
      () => request.destroy(new Error("Quota timeout")),
      5000,
    );
    const finish = (result: VaultStorageSpace) => {
      clearTimeout(timer);
      resolve(result);
    };
    request.on("error", () => finish({ status: "UNAVAILABLE" }));
    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        finish({
          status: [404, 405, 501].includes(response.statusCode || 0)
            ? "UNSUPPORTED"
            : "UNAVAILABLE",
        });
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let length = 0;
      response.on("error", () => finish({ status: "UNAVAILABLE" }));
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > 16384) {
          finish({ status: "UNAVAILABLE" });
          response.destroy();
        } else chunks.push(chunk);
      });
      response.on("end", () => {
        try {
          const quota = ZQuota.parse(
            JSON.parse(Buffer.concat(chunks).toString("utf8")),
          );
          if (quota.bucket !== value.bucket) throw new Error("Invalid quota");
          if (quota.quota_limit === null || quota.quota_limit === 0) {
            finish({
              status: "NO_QUOTA",
              ...(quota.current_usage !== null
                ? { usedBytes: quota.current_usage }
                : {}),
            });
            return;
          }
          if (
            quota.current_usage === null ||
            quota.remaining_quota === null ||
            quota.remaining_quota !==
              Math.max(0, quota.quota_limit - quota.current_usage)
          )
            throw new Error("Unavailable quota usage");
          finish({
            status: "QUOTA",
            availableBytes: quota.remaining_quota,
            totalBytes: quota.quota_limit,
            usedBytes: quota.current_usage,
          });
        } catch {
          finish({ status: "UNAVAILABLE" });
        }
      });
    });
    request.end();
  }).catch((): VaultStorageSpace => ({ status: "UNAVAILABLE" }));
  pending.set(key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
}
