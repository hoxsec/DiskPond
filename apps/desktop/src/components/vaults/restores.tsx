import { useRestoreList } from "@desktop/hooks/queries/use-restore-list";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Button } from "@diskpond/ui/button";
import { AlertCircleIcon, CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

export function VaultRestores() {
  const { data: restores, refetch, isError } = useRestoreList();
  const { t } = useAppTranslation("directory.restore");
  const [actionError, setActionError] = useState(false);
  async function action(run: () => Promise<unknown>) {
    try {
      setActionError(false);
      const response = await run();
      if (typeof response === "string" && response)
        throw new Error("ACTION_FAILED");
      await refetch();
    } catch {
      setActionError(true);
    }
  }
  if (!restores?.length && !isError) return null;
  return (
    <div className="mb-8 flex flex-col gap-4">
      {(isError || actionError) && <p role="alert">{t("actionError")}</p>}
      {restores?.map((restore) => {
        const active =
          restore.status === "RUNNING" || restore.status === "CANCELING";
        return (
          <section
            key={restore.id}
            className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium" role="status">
                {active ? (
                  <LoaderCircleIcon className="size-5 motion-safe:animate-spin" />
                ) : restore.status === "COMPLETE" ? (
                  <CheckIcon className="text-success size-5" />
                ) : (
                  <AlertCircleIcon className="size-5" />
                )}
                {t(`status.${restore.status}`)}
              </p>
              <p className="text-muted-foreground mt-2 break-all text-xs">
                {restore.destination}
              </p>
              <p className="text-muted-foreground break-all text-xs">
                {t("objects", { objects: restore.objects.join(", ") })}
              </p>
              {!active && (
                <p className="mt-2 text-sm">
                  {t("counts", {
                    restored: restore.restored,
                    skipped: restore.skipped,
                    errors: restore.errors,
                  })}
                </p>
              )}
              {restore.issue && (
                <p className="mt-2 text-sm">{t(`issue.${restore.issue}`)}</p>
              )}
              {!active && restore.status !== "COMPLETE" && (
                <p className="mt-2 text-sm">{t("incomplete")}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {active ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={restore.status === "CANCELING"}
                  onClick={() =>
                    action(() =>
                      window.electron.vault.restore.cancel({
                        id: restore.id,
                      }),
                    )
                  }
                >
                  {t("cancel")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    action(() =>
                      window.electron.vault.restore.dismiss({
                        id: restore.id,
                      }),
                    )
                  }
                >
                  {t("dismiss")}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  action(() =>
                    window.electron.shell.open.folder(restore.destination),
                  )
                }
              >
                {t("openFolder")}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
