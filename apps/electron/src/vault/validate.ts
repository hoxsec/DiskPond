import { opendir, stat } from "node:fs/promises";
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
  intent?: "CREATE" | "CONNECT";
}) {
  const storage = connectionFromProvider(vault.type, vault.config);
  let localEmpty: boolean | undefined;
  if (vault.intent && storage.type === "filesystem") {
    try {
      const path = z.string().parse(storage.config.path);
      if (!(await stat(path)).isDirectory()) return { code: "STORAGE_MISSING" };
      // Verify directory access for both actions. On Windows an unreadable
      // directory can report a missing child blob instead of access denied.
      const directory = await opendir(path);
      try {
        localEmpty = (await directory.read()) === null;
      } finally {
        await directory.close();
      }
    } catch (error) {
      return {
        code:
          error instanceof Error && "code" in error && error.code === "ENOENT"
            ? "STORAGE_MISSING"
            : "STORAGE_UNREACHABLE",
      };
    }
  }
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
  const checked = result.data;
  if (
    vault.intent &&
    checked.code === "INTERNAL" &&
    /invalid format blob|repository format blob has no identity/.test(
      checked.error || "",
    )
  )
    return { code: "INVALID_REPOSITORY" };
  if (vault.intent === "CREATE") {
    if (checked.uniqueID) return { code: "REPOSITORY_EXISTS" };
    if (checked.code === "NOT_INITIALIZED" && localEmpty === false) {
      // Even unrelated files or a damaged repository must not become a new
      // local vault. Read one entry only; never create the selected directory.
      return { code: "DESTINATION_NOT_EMPTY" };
    }
  }
  return checked;
}
