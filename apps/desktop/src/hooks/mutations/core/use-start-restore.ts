import type { DirectoryItem } from "@desktop/hooks/queries/core/use-directory";
import { useDirectoryId } from "@desktop/hooks/use-directory-id";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useSourceId } from "@desktop/hooks/use-source-id";
import { useVaultId } from "@desktop/hooks/use-vault-id";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { ZRestoreDirectoryType } from "@diskpond/schemas/directory";
import { CustomError } from "@diskpond/utils/error";
import { showErrorToast } from "@diskpond/utils/error-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useStartRestore(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  const { t } = useAppTranslation("directory.table.restore");

  const { vaultId } = useVaultId();
  const { directoryId } = useDirectoryId();
  const { sourceId } = useSourceId();
  const { queryKeys } = useQueryKey();

  return useMutation({
    mutationKey: ["file", "restore"],
    mutationFn: async (
      options:
        | { variant: "single"; item: DirectoryItem; snapshotId?: string }
        | { variant: "multiple"; items: DirectoryItem[] }
        | {
            variant: "directory";
            objectId: string;
            values: ZRestoreDirectoryType;
          },
    ) => {
      if (!vaultId || !sourceId)
        throw new CustomError("MISSING_REQUIRED_VALUE");
      if (
        options.variant !== "directory" &&
        !directoryId &&
        !(options.variant === "single" && options.snapshotId)
      )
        throw new CustomError("MISSING_REQUIRED_VALUE");

      if (options.variant === "single")
        return await window.electron.vault.restore.single({
          vaultId,
          sourceId,
          item: {
            ...options.item,
            ...(options.snapshotId
              ? { snapshotId: options.snapshotId }
              : { entryPath: `${directoryId}/${options.item.name}` }),
          },
          dialogTitle: t("single.dialog.title"),
        });

      if (options.variant === "multiple")
        return await window.electron.vault.restore.multiple({
          vaultId,
          sourceId,
          items: options.items.map((item) => ({
            ...item,
            entryPath: `${directoryId}/${item.name}`,
          })),
          dialogTitle: t("multiple.dialog.title"),
        });

      if (options.variant === "directory")
        return await window.electron.vault.restore.directory({
          vaultId,
          sourceId,
          options: options.values,
          objectId: options.objectId,
        });
    },
    onError: showErrorToast,
    onSuccess: async (res) => {
      if (res !== true) return;

      await queryClient.invalidateQueries({
        queryKey: queryKeys.source.restores(sourceId),
      });

      options?.onSuccess?.();
    },
  });
}
