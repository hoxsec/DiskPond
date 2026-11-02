import type { StorageProviderType } from "@blinkdisk/constants/providers";
import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import {
  connectionFromProvider,
  rememberConnectionSecrets,
} from "@electron/vault/connection";
import { fetchVault } from "@electron/vault/fetch";
import { startVaultServer } from "@electron/vault/server";
import type { VaultInstance } from "@electron/vault/types";
import { z } from "zod";

export let validationVault: VaultInstance | null = null;

export async function validateVaultConfig(vault: {
  type: StorageProviderType;
  config: ProviderConfig;
  version?: number;
  password?: string;
}) {
  const storage = connectionFromProvider(vault.type, vault.config);
  if (
    !validationVault ||
    validationVault.server.process.killed ||
    validationVault.server.process.exitCode !== null
  ) {
    const id = "temporary";

    validationVault = {
      id,
      status: "RUNNING",
      server: await startVaultServer(id, false),
    };
  }

  rememberConnectionSecrets(validationVault.id, storage, vault.password);
  const result = z
    .object({
      code: z.string().optional(),
      error: z.string().optional(),
      uniqueID: z.string().optional(),
    })
    .safeParse(
      await fetchVault(validationVault, {
        method: "POST",
        path: "/api/v1/repo/exists",
        data: {
          storage,
          ...(vault.password && { password: vault.password }),
        },
      }),
    );
  if (!result.success) throw new Error("Invalid discovery response");
  return result.data;
}
