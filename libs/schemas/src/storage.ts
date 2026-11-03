import { z } from "zod";

export const ZVaultStorageSpace = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("AVAILABLE"),
      availableBytes: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ status: z.literal("UNSUPPORTED") }).strict(),
  z.object({ status: z.literal("UNAVAILABLE") }).strict(),
]);

export type VaultStorageSpace = z.infer<typeof ZVaultStorageSpace>;
