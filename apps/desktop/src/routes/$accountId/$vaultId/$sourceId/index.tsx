import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { isFileLikeSource } from "@blinkdisk/schemas/source";
import { Button } from "@blinkdisk/ui/button";
import { Skeleton } from "@blinkdisk/ui/skeleton";
import { cn } from "@blinkdisk/utils/class";
import { BackupProgress } from "@desktop/components/backups/progress";
import { BackupTimeline } from "@desktop/components/backups/timeline";
import { Empty } from "@desktop/components/empty";
import { BackupIssueAlert } from "@desktop/components/sources/backup-issue";
import { SourcePreview } from "@desktop/components/sources/preview";
import { LocalButton } from "@desktop/components/vaults/local-button";
import { VaultRestores } from "@desktop/components/vaults/restores";
import { useBackupStartFeedback } from "@desktop/hooks/mutations/core/use-backup-start-feedback";
import { useCancelBackup } from "@desktop/hooks/mutations/core/use-cancel-backup";
import { useCompletedBackupList } from "@desktop/hooks/queries/use-completed-backup-list";
import { useSource } from "@desktop/hooks/use-source";
import { policyTargetToSearch } from "@desktop/lib/policy-target";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ClockIcon,
  CloudUploadIcon,
  FileCogIcon,
  ListPlusIcon,
  SquareIcon,
} from "lucide-react";

export const Route = createFileRoute("/$accountId/$vaultId/$sourceId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useAppTranslation("backup.list");

  const { data: source } = useSource();
  const { data: backups } = useCompletedBackupList();
  const navigate = Route.useNavigate();
  const sourceTypeKey = isFileLikeSource(source?.type) ? "file" : "folder";

  const { startBackup, isStartingBackup } = useBackupStartFeedback({
    isRunning: source?.status === "PENDING" || source?.status === "UPLOADING",
    source,
  });
  const { mutate: cancelBackup, isPending: isCancellingBackup } =
    useCancelBackup();

  return (
    <div
      className={cn(
        "flex min-h-full flex-col overflow-x-hidden p-6",
        backups !== undefined && backups !== null
          ? "overflow-y-auto"
          : "overflow-hidden",
      )}
    >
      <Button
        variant="secondary"
        size="sm"
        className="mb-6 w-fit shrink-0"
        nativeButton={false}
        render={
          <Link
            to="/$accountId/$vaultId"
            from="/$accountId/$vaultId/$sourceId/"
            search={true}
          />
        }
      >
        <ArrowLeftIcon aria-hidden="true" />
        {t("backToVault")}
      </Button>
      <VaultRestores />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-60">
          <SourcePreview source={source} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {backups !== null && backups !== undefined ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  source &&
                  navigate({
                    to: "/$accountId/$vaultId/policies",
                    search: policyTargetToSearch({
                      kind: "SOURCE",
                      hostName: source.source.host,
                      userName: source.source.userName,
                      path: source.source.path,
                    }),
                  })
                }
              >
                <FileCogIcon />
                {t(`settings.${sourceTypeKey}`)}
              </Button>
              {source && source.status === "UPLOADING" ? (
                <LocalButton
                  variant="secondary"
                  onClick={() =>
                    source.currentTask &&
                    cancelBackup({ taskId: source.currentTask })
                  }
                  loading={
                    isCancellingBackup ||
                    source?.currentTaskStatus === "CANCELING"
                  }
                >
                  <SquareIcon />
                  {t("cancel")}
                </LocalButton>
              ) : (
                <LocalButton
                  onClick={() =>
                    source && startBackup({ path: source.source.path })
                  }
                  loading={isStartingBackup}
                >
                  <CloudUploadIcon />
                  {t(`backup.${sourceTypeKey}`)}
                </LocalButton>
              )}
            </>
          ) : (
            <>
              <Skeleton width="10rem" height="2.75rem" />
              <Skeleton width="9rem" height="2.75rem" />
            </>
          )}
        </div>
      </div>
      <BackupIssueAlert source={source} />
      {backups !== null && backups !== undefined && backups.length === 0 ? (
        source?.status === "UPLOADING" &&
        source.currentTaskStatus === "CANCELING" ? (
          <Empty
            icon={<SquareIcon />}
            title={t("empty.canceling.title")}
            description={t("empty.canceling.description")}
          />
        ) : source?.status === "UPLOADING" ? (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div className="mt-auto"></div>
            <CloudUploadIcon
              aria-hidden="true"
              className="text-muted-foreground size-16"
            />
            <h1 className="mt-2 whitespace-pre-wrap text-center text-3xl font-bold">
              {t("empty.initial.title")}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-sm text-center text-sm">
              {t("empty.initial.description")}
            </p>
            <div className="mt-10">
              <BackupProgress upload={source.upload} />
            </div>
            <div className="mb-auto"></div>
          </div>
        ) : isStartingBackup || source?.status === "PENDING" ? (
          <Empty
            icon={<ClockIcon />}
            title={t("empty.pending.title")}
            description={t("empty.pending.description")}
          />
        ) : (
          <Empty
            icon={<ListPlusIcon />}
            title={t("empty.default.title")}
            description={t("empty.default.description")}
          >
            <LocalButton
              onClick={() =>
                source && startBackup({ path: source.source.path })
              }
              loading={isStartingBackup}
              disabled={!source}
              size="lg"
            >
              <CloudUploadIcon />
              {t("empty.default.button")}
            </LocalButton>
          </Empty>
        )
      ) : (
        <BackupTimeline backups={backups} />
      )}
    </div>
  );
}
