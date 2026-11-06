import { z } from "zod";

const bytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const ZVaultStorageSpace = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("AVAILABLE"),
      availableBytes: bytes,
      totalBytes: bytes.optional(),
      usedBytes: bytes.optional(),
    })
    .strict(),
  z.object({ status: z.literal("UNSUPPORTED") }).strict(),
  z
    .object({
      status: z.literal("QUOTA"),
      availableBytes: bytes,
      totalBytes: bytes.optional(),
      usedBytes: bytes.optional(),
    })
    .strict(),
  z
    .object({ status: z.literal("NO_QUOTA"), usedBytes: bytes.optional() })
    .strict(),
  z.object({ status: z.literal("UNAVAILABLE") }).strict(),
]);

export type VaultStorageSpace = z.infer<typeof ZVaultStorageSpace>;
