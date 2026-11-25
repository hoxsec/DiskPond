import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useVaultId } from "@desktop/hooks/use-vault-id";
import { CustomError } from "@diskpond/utils/error";
import { queryOptions, useQuery } from "@tanstack/react-query";

export function vaultStatusOptions(
  queryKey: readonly unknown[],
  vaultId?: string,
) {
  return queryOptions({
    queryKey,
    queryFn: () => {
      if (!vaultId) throw new CustomError("MISSING_REQUIRED_VALUE");
      return window.electron.vault.status(vaultId);
    },
    enabled: !!vaultId,
    networkMode: "always",
    retry: false,
    refetchInterval: 1000,
  });
}

export function useVaultStatus(vaultIdOverride?: string) {
  const { queryKeys } = useQueryKey();
  const { vaultId: routeVaultId } = useVaultId();
  const vaultId = vaultIdOverride ?? routeVaultId;
  const query = useQuery(
    vaultStatusOptions(queryKeys.vault.status(vaultId), vaultId),
  );
  return {
    ...query,
    status: query.data?.status,
    initTask: query.data?.initTask,
    running: query.data?.status === "RUNNING",
  };
}
