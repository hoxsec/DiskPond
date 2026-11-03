import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { useTaskDialog } from "@desktop/hooks/state/use-task-dialog";
import { VaultIcon } from "lucide-react";

export function VaultStarting() {
  const { t } = useAppTranslation("vault.starting");
  const { initTask } = useVaultStatus();
  const { openTaskDialog } = useTaskDialog();

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto py-12">
      <div className="mt-auto"></div>
      <div className="flex flex-col items-center justify-center">
        <div className="flex size-16 items-center justify-center border bg-muted text-primary">
          <VaultIcon className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-4 max-w-72 text-center">
          {t("description")}
        </p>
        {initTask && (
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => openTaskDialog({ taskId: initTask })}
          >
            Show Logs
          </Button>
        )}
      </div>
      <div className="mb-auto"></div>
    </div>
  );
}
