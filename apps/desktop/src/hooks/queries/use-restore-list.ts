import { ZRestoreResult } from "@blinkdisk/schemas/restore";
import { CustomError } from "@blinkdisk/utils/error";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useSourceId } from "@desktop/hooks/use-source-id";
import { useQuery } from "@tanstack/react-query";

export function useRestoreList() {
  const { queryKeys } = useQueryKey();
  const { sourceId } = useSourceId();

  return useQuery({
    queryKey: queryKeys.source.restores(sourceId),
    queryFn: async () => {
      if (!sourceId) throw new CustomError("MISSING_REQUIRED_VALUE");

      return ZRestoreResult.array().parse(
        await window.electron.vault.restore.list({
          sourceId,
        }),
      );
    },
    refetchInterval: 1000,
    enabled: !!sourceId,
  });
}
