import { z } from "zod";

// IDs are also used as native filenames and electron-store path segments.
export const ZPasswordVault = z
  .object({
    vaultId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/)
      .refine(
        (value) => !["__proto__", "constructor", "prototype"].includes(value),
      ),
  })
  .strict();

export const ZSetVaultPassword = ZPasswordVault.extend({
  password: z.string().min(1).max(65_536),
});

export const ZStoredPassword = z
  .object({
    type: z.enum(["ENCRYPTED", "PLAIN"]),
    data: z.string(),
  })
  .strict();

export type PasswordStorageStatus = {
  mode: "PROTECTED" | "SESSION";
  reason: "UNAVAILABLE" | "PROTECTION_FAILED" | "SAVE_FAILED" | null;
  needsPassword: boolean;
  cleanupFailed: boolean;
};
