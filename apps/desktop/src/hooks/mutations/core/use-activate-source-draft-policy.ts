import type { ZPolicyType } from "@blinkdisk/schemas/policy";
import { CustomError } from "@blinkdisk/utils/error";
import { showErrorToast } from "@blinkdisk/utils/error-toast";
import { useAccountId } from "@desktop/hooks/use-account-id";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useVaultId } from "@desktop/hooks/use-vault-id";
import { convertPolicyToCore } from "@desktop/lib/policy";
import {
  type PolicyTarget,
  policyTargetToKopiaParams,
} from "@desktop/lib/policy-target";
import { buildSourceId } from "@desktop/lib/source";
import { vaultApi } from "@desktop/lib/vault";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export function useActivateSourceDraftPolicy({
  target,
  onError,
  onSuccess,
}: {
  target: Extract<PolicyTarget, { kind: "DRAFT_SOURCE" }> | null | undefined;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
}) {
  const navigate = useNavigate({ from: "/$accountId/$vaultId" });
  const queryClient = useQueryClient();
  const { queryKeys } = useQueryKey();
  const { accountId } = useAccountId();
  const { vaultId } = useVaultId();

  return useMutation({
    mutationKey: ["core", "source", "policy", "draft", "activate"],
    mutationFn: async ({ policy }: { policy: ZPolicyType }) => {
      const draftTarget = target;

      if (!accountId || !vaultId || !draftTarget)
        throw new CustomError("MISSING_REQUIRED_VALUE");

      await vaultApi(vaultId).post("/api/v1/sources", {
        path: draftTarget.path,
        createSnapshot: false,
        policy: convertPolicyToCore(policy),
      });

      await vaultApi(vaultId).delete("/api/v1/policy", {
        params: policyTargetToKopiaParams(draftTarget),
      });

      const id = buildSourceId({
        device: draftTarget.hostName,
        user: draftTarget.userName,
        path: draftTarget.path,
      });

      return { accountId, id, vaultId, target: draftTarget };
    },
    onError: (error) => {
      onError?.(error);

      showErrorToast(error);
    },
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.source.list(res.vaultId, {
            deviceName: res.target.hostName,
            userName: res.target.userName,
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.policy.all,
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
