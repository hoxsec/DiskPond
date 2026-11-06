import { BackupIssueDialog } from "@desktop/components/dialogs/backup-issue";
import { useBackupStartFeedback } from "@desktop/hooks/mutations/core/use-backup-start-feedback";
import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import { useProtectionStatus } from "@desktop/hooks/queries/use-protection-status";
import { useCreateVaultDialog } from "@desktop/hooks/state/use-create-vault-dialog";
import { useTaskDialog } from "@desktop/hooks/state/use-task-dialog";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { getBackupIssue } from "@desktop/lib/backup-issue";
import { policyTargetToSearch } from "@desktop/lib/policy-target";
import { protectionAction } from "@desktop/lib/protection-status";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { ZVaultType } from "@diskpond/schemas/vault";
import { showErrorToast } from "@diskpond/utils/error-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ProtectionStatusCard } from "./protection-status";

export function ProtectionOverview({ vaults }: { vaults?: ZVaultType[] }) {
  const { t, language } = useAppTranslation("vault.protection");
  const model = useProtectionStatus(vaults);
  const { state, source, vault } = model;
  const { accountId } = useParams({ from: "/$accountId" });
  const navigate = useNavigate();
  const { openCreateVault } = useCreateVaultDialog();
  const { openTaskDialog } = useTaskDialog();
  const { queryKeys } = useQueryKey();
  const queryClient = useQueryClient();
  const actionRef = useRef<HTMLButtonElement>(null);
  const [issue, setIssue] = useState<{
    source: CoreSourceItem;
    vaultId: string;
  } | null>(null);
  const { startBackup, isStartingBackup } = useBackupStartFeedback({
    vaultId: vault?.id,
    profile: source
      ? { deviceName: source.source.host, userName: source.source.userName }
      : null,
    source,
    sources: vault?.sources,
    isRunning: source?.status === "UPLOADING" || source?.status === "PENDING",
  });
  const refresh = useMutation({
    mutationFn: async () => {
      if (vault) {
        const connection = await window.electron.vault.status(vault.id);
        if (!connection || connection.status === "FAILED")
          await window.electron.vault.retry(vault.id);
      }
      await model.refetch();
    },
    onError: showErrorToast,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.vault.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.source.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backup.all }),
      ]),
  });
  const openSource = (target = source, vaultId = vault?.id) =>
    target && vaultId
      ? navigate({
          to: "/$accountId/$vaultId/$sourceId",
          params: { accountId, vaultId, sourceId: target.id },
        })
      : navigate({ to: "/$accountId/activity", params: { accountId } });
  const canShowIssue = !!source && !!getBackupIssue(source);
  const canStart = !!source && source.status === "IDLE";
  const action = protectionAction(model);

  function runAction() {
    if (action === "checkAgain") refresh.mutate();
    else if (action === "createVault") openCreateVault();
    else if (action === "openVault" && vault)
      void navigate({
        to: "/$accountId/$vaultId",
        params: { accountId, vaultId: vault.id },
      });
    else if (action === "backUpNow" && source && canStart)
      startBackup({ path: source.source.path });
    else if (
      (action === "viewFiles" || action === "viewDetails") &&
      canShowIssue &&
      source &&
      vault
    )
      setIssue({ source, vaultId: vault.id });
    else if (action === "viewSchedule" && source && vault)
      void navigate({
        to: "/$accountId/$vaultId/policies",
        params: { accountId, vaultId: vault.id },
        search: policyTargetToSearch({
          kind: "SOURCE",
          hostName: source.source.host,
          userName: source.source.userName,
          path: source.source.path,
        }),
      });
    else if (action === "viewBackups") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.backup.all });
      void navigate({ to: "/$accountId/activity", params: { accountId } });
    } else void openSource();
  }

  const formatTime = (time: number) =>
    new Date(time).toLocaleString(language, {
      dateStyle: "short",
      timeStyle: "short",
    });
  const lastBackup =
    state === "checking" || model.historyPending
      ? t("times.checking")
      : state === "unavailable" || model.historyUnavailable
        ? t("times.unavailable")
        : model.lastSuccess
          ? formatTime(model.lastSuccess)
          : t("times.never");
  const nextBackup =
    state === "checking"
      ? t("times.checking")
      : state === "unavailable"
        ? t("times.unavailable")
        : model.nextBackup
          ? formatTime(model.nextBackup)
          : state === "running" || state === "queued"
            ? t("times.inProgress")
            : state === "paused"
              ? t("times.paused")
              : state === "remote"
                ? t("times.remote")
                : model.hasSchedules
                  ? t("times.waiting")
                  : t("times.manual");

  return (
    <div className="mb-4">
      <ProtectionStatusCard
        status={state}
        summary={t(
          `summary.${state === "empty" && vault ? "emptyVault" : state}`,
          {
            count: model.count,
            name:
              source?.name ||
              source?.source.path.split(/[\\/]/).filter(Boolean).at(-1) ||
              "",
            vault: vault?.name || "",
          },
        )}
        lastBackup={lastBackup}
        nextBackup={nextBackup}
        action={t(`actions.${action}`)}
        onAction={state === "checking" ? undefined : runAction}
        actionPending={
          refresh.isPending || (action === "backUpNow" && isStartingBackup)
        }
        actionRef={actionRef}
        opensDialog={
          (action === "viewFiles" || action === "viewDetails") && canShowIssue
        }
      />
      {issue ? (
        <BackupIssueDialog
          source={issue.source}
          finalFocus={actionRef}
          onOpenChange={(open) => {
            if (!open) setIssue(null);
          }}
          onViewLogs={(taskId) => {
            const selected = issue;
            setIssue(null);
            void openSource(selected.source, selected.vaultId)
              .then(() => openTaskDialog({ taskId }))
              .catch(showErrorToast);
          }}
        />
      ) : null}
    </div>
  );
}
