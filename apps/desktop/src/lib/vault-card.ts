import {
  getStorageProvider,
  type StorageProviderType,
} from "@blinkdisk/constants/providers";
import type { VaultColor } from "@blinkdisk/constants/vault-color";
import type { ConnectionSummary } from "@blinkdisk/schemas/connection";
import type { inspectBackupHealth } from "@desktop/lib/backup-health";

export const vaultColorClasses: Record<VaultColor, string> = {
  blue: "[--vault-color:#1d4ed8] [--vault-bg:#e8efff] dark:[--vault-color:#93baff] dark:[--vault-bg:#25334d]",
  green:
    "[--vault-color:#16704a] [--vault-bg:#e7f4ed] dark:[--vault-color:#86d6ab] dark:[--vault-bg:#213a2d]",
  purple:
    "[--vault-color:#7852b5] [--vault-bg:#f0eafa] dark:[--vault-color:#c3a7ee] dark:[--vault-bg:#352a47]",
  amber:
    "[--vault-color:#94600e] [--vault-bg:#faf0dd] dark:[--vault-color:#e7bd70] dark:[--vault-bg:#3b3020]",
  rose: "[--vault-color:#b33b65] [--vault-bg:#fbeaf0] dark:[--vault-color:#efa1bb] dark:[--vault-bg:#442b35]",
  graphite:
    "[--vault-color:#525d6f] [--vault-bg:#eef0f4] dark:[--vault-color:#b6c0d0] dark:[--vault-bg:#272c35]",
};

export function defaultVaultColor(provider: StorageProviderType): VaultColor {
  const storage = getStorageProvider(provider);
  if (storage?.type === "EXTERNAL_DRIVE") return "amber";
  if (storage?.local) return "blue";
  if (storage?.type === "DISKPOND_CLOUD") return "purple";
  return "green";
}

export function vaultLocation(summary?: ConnectionSummary) {
  const fields = new Map(
    summary?.fields.map(({ key, value }) => [key, String(value)]),
  );
  const path = fields.get("path") || fields.get("remotePath");
  const host = fields.get("host");
  if (host)
    return `${host}${fields.has("port") ? `:${fields.get("port")}` : ""}${path ? ` · ${path}` : ""}`;
  if (path) return path;
  const bucket = fields.get("bucket") || fields.get("container");
  const destination = bucket
    ? [bucket, fields.get("prefix")?.replace(/^\/+/, "")]
        .filter(Boolean)
        .join("/")
    : undefined;
  return [destination, fields.get("endpoint")].filter(Boolean).join(" · ");
}

export function vaultBackupState(
  status: "SETUP" | "STARTING" | "RUNNING" | "FAILED" | undefined,
  health: ReturnType<typeof inspectBackupHealth> | null | undefined,
  loading: boolean,
  error: boolean,
) {
  if (error) return "unavailable";
  if (status === "FAILED") return "offline";
  if (status === "SETUP") return "setup";
  if (status === "STARTING" || loading) return "checking";
  if (status !== "RUNNING" || !health) return "unavailable";
  if (health.uploading) return "uploading";
  if (health.pending) return "queued";
  if (health.sourcesWithIssues) return "issues";
  if (!health.latestBackup) return "new";
  return health.sourceCount > 0 && health.freshSources === health.sourceCount
    ? "current"
    : "stale";
}
