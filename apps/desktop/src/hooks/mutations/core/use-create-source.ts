import type { ZCreateSourceFormType } from "@blinkdisk/schemas/source";
import { CustomError } from "@blinkdisk/utils/error";
import { showErrorToast } from "@blinkdisk/utils/error-toast";
import { useAccountId } from "@desktop/hooks/use-account-id";
import { useLocalProfile } from "@desktop/hooks/use-local-profile";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useVaultId } from "@desktop/hooks/use-vault-id";
import { profileFromParts } from "@desktop/lib/profile";
import { buildSourceId } from "@desktop/lib/source";
import { vaultApi } from "@desktop/lib/vault";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

export function useCreateSource({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError?: (error: unknown) => void;
}) {
  const navigate = useNavigate({ from: "/$accountId/$vaultId" });
  const queryClient = useQueryClient();

  const { accountId } = useAccountId();
  const { vaultId } = useVaultId();
  const { localHostName, localUserName } = useLocalProfile();
  const { queryKeys } = useQueryKey();
  const profile = useMemo(
    () =>
      profileFromParts({
        hostName: localHostName,
        userName: localUserName,
      }),
    [localHostName, localUserName],
  );

  return useMutation({
    mutationKey: ["source", "create"],
    mutationFn: async (values: ZCreateSourceFormType) => {
      if (!accountId || !vaultId || !profile)
        throw new CustomError("MISSING_REQUIRED_VALUE");

      await vaultApi(vaultId).post("/api/v1/sources", {
        path: values.path,
        createSnapshot: false,
        policy: {
          name: values.name,
          emoji: values.emoji,
          initialSourceType: values.type,
        },
      });

      const id = buildSourceId({
        device: profile.deviceName,
        user: profile.userName,
        path: values.path,
      });

      return { accountId, id, profile, vaultId };
    },
    onError: (error) => {
      onError?.(error);

      showErrorToast(error);
    },
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.source.list(vaultId, res.profile),
        }),
        // Policies can be nested inside sources.
        queryClient.invalidateQueries({
          queryKey: queryKeys.policy.sources(),
        }),
      ]);

      await navigate({
        to: "/$accountId/$vaultId/$sourceId",
        params: (params) => ({
          ...params,
          sourceId: res.id,
        }),
      });

      onSuccess?.();
    },
  });
}
