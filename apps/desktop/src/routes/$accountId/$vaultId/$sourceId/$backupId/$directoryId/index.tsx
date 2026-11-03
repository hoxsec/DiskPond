import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { BackupPreview } from "@desktop/components/backups/preview";
import {
  DirectoryTable,
  type Item as DirectoryTableItem,
} from "@desktop/components/directories/table";
import { Empty } from "@desktop/components/empty";
import { VaultRestores } from "@desktop/components/vaults/restores";
import { useStartMount } from "@desktop/hooks/mutations/core/use-start-mount";
import { useStartRestore } from "@desktop/hooks/mutations/core/use-start-restore";
import { useDirectory } from "@desktop/hooks/queries/core/use-directory";
import { usePlatform } from "@desktop/hooks/queries/use-platform";
import { useRestoreDirectoryDialog } from "@desktop/hooks/state/use-restore-directory-dialog";
import { useBackup } from "@desktop/hooks/use-backup";
import { useDirectoryId } from "@desktop/hooks/use-directory-id";
import { useSource } from "@desktop/hooks/use-source";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CloudDownloadIcon,
  FilePlusIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";

type DirectoryTableSelection = {
  items: DirectoryTableItem[];
  allSelected: boolean;
};

export const Route = createFileRoute(
  "/$accountId/$vaultId/$sourceId/$backupId/$directoryId/",
)({
  component: RouteComponent,
  validateSearch: z.object({
    path: z
      .object({
        objectId: z.string(),
        name: z.string(),
      })
      .array()
      .optional(),
  }),
});

function RouteComponent() {
  const scrollParent = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<DirectoryTableSelection>({
    items: [],
    allSelected: false,
  });

  const { t } = useAppTranslation("directory");
  const { path } = Route.useSearch();
  const { directoryId } = useDirectoryId();

  const { data: source } = useSource();
  const { data: backup } = useBackup();
  const { data: directory } = useDirectory();
  const { data: platform } = usePlatform();
  const { openRestoreDirectory } = useRestoreDirectoryDialog();
  const { mutate: startMount, isPending: isStartMountPending } =
    useStartMount();
  const { mutate: startRestore, isPending: isStartingRestore } =
    useStartRestore();

  const updateSelection = useCallback((selection: DirectoryTableSelection) => {
    setSelection(selection);
  }, []);

  const selectedItemCount = selection.items.length;

  return (
    <div
      ref={scrollParent}
      className="flex h-full min-h-0 w-full flex-col overflow-y-auto p-6"
    >
      <Button
        variant="secondary"
        size="sm"
        className="mb-6 w-fit shrink-0"
        nativeButton={false}
        render={
          <Link
            to="/$accountId/$vaultId/$sourceId"
            from="/$accountId/$vaultId/$sourceId/$backupId/$directoryId/"
            search={({ otherHostName, otherUserName }) => ({
              otherHostName,
              otherUserName,
            })}
          />
        }
      >
        <ArrowLeftIcon aria-hidden="true" />
        {t("backToHistory")}
      </Button>
      <div className="mb-6 flex w-full shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-60">
          {backup && source ? (
            <BackupPreview backup={backup} source={source} />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => startMount()}
            loading={isStartMountPending}
            variant="secondary"
          >
            <FolderOpenIcon />
            {t(
              `table.mount.open.${
                platform === "windows"
                  ? "windows"
                  : platform === "macos"
                    ? "macos"
                    : "other"
              }`,
            )}
          </Button>
          <Button
            onClick={() => {
              if (selection.items.length === 0 || selection.allSelected) {
                openRestoreDirectory({
                  directoryId: directoryId || "",
                  path,
                  source,
                  backup,
                });
                return;
              }

              if (selection.items.length === 1 && selection.items[0]) {
                startRestore({
                  variant: "single",
                  item: selection.items[0],
                });
                return;
              }

              startRestore({
                variant: "multiple",
                items: selection.items,
              });
            }}
            loading={isStartingRestore}
          >
            <CloudDownloadIcon />
            {selectedItemCount > 0
              ? t("table.restore.selected", {
                  count: selectedItemCount,
                })
              : t("table.restore.folder")}
          </Button>
        </div>
      </div>
      <div className="flex min-h-60 w-full flex-1 flex-col">
        <VaultRestores />
        {directory !== null &&
        directory !== undefined &&
        directory.length === 0 ? (
          <Empty
            icon={<FilePlusIcon />}
            title={t("table.empty.title")}
            description={t("table.empty.description")}
          />
        ) : (
          <DirectoryTable
            items={
              directory !== undefined
                ? directory
                : new Array(5).fill({ name: "", skeleton: true, size: 0 })
            }
            onSelectionChange={updateSelection}
          />
        )}
      </div>
    </div>
  );
}
