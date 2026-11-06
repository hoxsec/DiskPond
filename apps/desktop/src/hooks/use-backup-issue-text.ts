import type { CoreSourceItem } from "@desktop/hooks/queries/core/use-source-list";
import type { BackupIssueReason } from "@desktop/lib/backup-issue";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { isFileLikeSource } from "@diskpond/schemas/source";
import { useCallback } from "react";

export function useBackupIssueText() {
  const { t } = useAppTranslation("folder.backupError");

  return useCallback(
    (source: CoreSourceItem, reason: BackupIssueReason) => {
      const sourceTypeKey = isFileLikeSource(source.type) ? "file" : "folder";

      return {
        label: t(`label.${reason}.${sourceTypeKey}`),
        description: t(`description.${reason}.${sourceTypeKey}`),
      };
    },
    [t],
  );
}
