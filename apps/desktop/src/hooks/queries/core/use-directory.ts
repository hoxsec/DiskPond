import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { useDirectoryId } from "@desktop/hooks/use-directory-id";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useVaultId } from "@desktop/hooks/use-vault-id";
import { readHistoryDirectory } from "@desktop/lib/history";
import { useQuery } from "@tanstack/react-query";

export type CoreDirectorySummary = {
  size: number;
  files: number;
  symlinks: number;
  dirs: number;
  maxTime: string;
  numFailed: number;
  numIgnoredErrors?: number;
  errors?: { path: string; error: string }[];
};

export type DirectoryItem = {
  id: string;
  objectId: string;
  name: string;
  type: "FILE" | "DIRECTORY" | "SYMLINK";
  size?: number;
  meta: {
    mode: string;
    uid: number;
    gid: number;
  };
  stats: {
    size: number;
    files?: number;
    symlinks?: number;
    directories?: number;
    failed?: number;
    maxTime?: string | null;
  };
  modifiedAt: string;
};

export function useDirectory() {
  const { queryKeys } = useQueryKey();
  const { vaultId } = useVaultId();
  const { directoryId } = useDirectoryId();
  const { running } = useVaultStatus();

  return useQuery({
    queryKey: [...queryKeys.directory.detail(directoryId), vaultId],
    queryFn: async ({ signal }) => {
      if (!vaultId || !directoryId)
        throw new Error("Missing directory identity");
      const entries = await readHistoryDirectory(vaultId, directoryId, signal);
      return entries.map(
        (entry) =>
          ({
            id: `${entry.obj}:${entry.name}`,
            objectId: entry.obj,
            name: entry.name,
            size: entry.size,
            type:
              entry.type === "d"
                ? "DIRECTORY"
                : entry.type === "s"
                  ? "SYMLINK"
                  : "FILE",
            meta: {
              mode: entry.mode ?? "",
              uid: entry.uid ?? 0,
              gid: entry.gid ?? 0,
            },
            stats: {
              size: entry.size || entry.summ?.size || 0,
              ...(entry.summ
                ? {
                    files: entry.summ?.files || 0,
                    symlinks: entry.summ?.symlinks || 0,
                    directories: entry.summ?.dirs || 0,
                    failed: entry.summ?.numFailed || 0,
                    maxTime: entry.summ?.maxTime || null,
                  }
                : {}),
            },
            modifiedAt: entry.mtime ?? "",
          }) satisfies DirectoryItem,
      );
    },
    enabled: !!vaultId && !!directoryId && running,
  });
}
