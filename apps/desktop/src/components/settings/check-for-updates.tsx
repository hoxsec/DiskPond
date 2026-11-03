import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { showErrorToast } from "@blinkdisk/utils/error-toast";
import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";
import { useState } from "react";

export function CheckForUpdates() {
  const { t } = useAppTranslation("workspace.settings.about");
  const { status, setStatus } = useUpdateStatus();
  const [state, setState] = useState<"idle" | "checking" | "checked" | "error">(
    "idle",
  );
  async function check() {
    setState("checking");
    try {
      setStatus(await window.electron.update.check());
      setState("checked");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        loading={state === "checking"}
        onClick={check}
      >
        {t("checkUpdates")}
      </Button>
      <span role="status" className="text-sm text-muted-foreground">
        {state === "error"
          ? t("updateError")
          : state === "checked"
            ? status?.available
              ? t("updateAvailable", { version: status.version })
              : t("upToDate")
            : null}
      </span>
      {status?.available ? (
        <Button
          variant="secondary"
          onClick={() => {
            void window.electron.update.openReleases().catch(showErrorToast);
          }}
        >
          {t("releases")}
        </Button>
      ) : null}
    </div>
  );
}
