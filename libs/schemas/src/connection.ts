import { getStorageProvider } from "@blinkdisk/constants/providers";
import { ZPasswordVault } from "@schemas/password";
import {
  ZAmazonS3Config,
  ZAzureBlobStorageConfig,
  ZBackblazeConfig,
  ZDiskPondCloudConfig,
  ZFilesystemConfig,
  ZGoogleCloudStorageConfig,
  ZProviderType,
  ZRcloneConfig,
  ZS3CompatibleConfig,
  ZSftpConfig,
  ZWebDavConfig,
} from "@schemas/providers";
import { ZVaultOptions } from "@schemas/vault";
import { z } from "zod";

const configSchemas = {
  INTERNAL_DRIVE: ZFilesystemConfig,
  EXTERNAL_DRIVE: ZFilesystemConfig,
  NETWORK_DRIVE: ZFilesystemConfig,
  AMAZON_S3: ZAmazonS3Config,
  S3_COMPATIBLE: ZS3CompatibleConfig,
  DISKPOND_CLOUD: ZDiskPondCloudConfig,
  BACKBLAZE: ZBackblazeConfig,
  GOOGLE_CLOUD_STORAGE: ZGoogleCloudStorageConfig,
  AZURE_BLOB_STORAGE: ZAzureBlobStorageConfig,
  SFTP: ZSftpConfig,
  WEBDAV: ZWebDavConfig,
  RCLONE: ZRcloneConfig,
};

export const ZProviderConnection = z
  .object({
    provider: ZProviderType,
    config: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()]).optional(),
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    const type = getStorageProvider(value.provider)?.type;
    if (
      !type ||
      !(type in configSchemas) ||
      JSON.stringify(value.config).length > 1_048_576
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid provider configuration",
      });
      return;
    }
    const schema = Object.entries(configSchemas).find(
      ([key]) => key === type,
    )?.[1];
    if (!schema?.safeParse(value.config).success)
      ctx.addIssue({
        code: "custom",
        message: "Invalid provider configuration",
      });
  });

export const ZConnectVaultRequest = ZProviderConnection.safeExtend({
  id: ZPasswordVault.shape.vaultId,
  name: z.string().min(1).max(30),
  password: z.string().min(1).max(65_536),
  version: z.number().int().optional(),
});
export const ZCreateVaultRequest = z
  .object({
    vault: ZConnectVaultRequest.safeExtend({
      // The ID is also used as the engine's repository KDF salt.
      id: ZPasswordVault.shape.vaultId.min(16),
      options: ZVaultOptions,
    }),
    userPolicy: z.record(z.string(), z.unknown()),
    globalPolicy: z.record(z.string(), z.unknown()),
  })
  .strict();
export const ZUnlockVaultRequest = ZPasswordVault.extend({
  password: z.string().min(1).max(65_536),
  config: ZProviderConnection.shape.config.nullable().optional(),
});
export const ZValidateConnection = z
  .object({
    type: ZProviderType,
    config: ZProviderConnection.shape.config,
    intent: z.enum(["CREATE", "CONNECT"]).optional(),
    password: z.string().max(65_536).optional(),
    version: z.number().int().optional(),
  })
  .strict();
export type ConnectionSummary = {
  fields: {
    key:
      | "path"
      | "host"
      | "port"
      | "bucket"
      | "region"
      | "prefix"
      | "container"
      | "endpoint"
      | "remotePath"
      | "rclonePath"
      | "disableTls"
      | "disableTlsVerification";
    value: string | number | boolean;
  }[];
} | null;
export const ZManagedStorage = z
  .object({
    type: z.enum([
      "filesystem",
      "s3",
      "b2",
      "gcs",
      "azureBlob",
      "sftp",
      "webdav",
      "rclone",
    ]),
    config: z.record(z.string(), z.unknown()),
  })
  .strict();
export type ManagedStorage = z.infer<typeof ZManagedStorage>;
