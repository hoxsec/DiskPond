import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Alert, AlertDescription, AlertTitle } from "@blinkdisk/ui/alert";
import { Button } from "@blinkdisk/ui/button";
import { SidebarMenuItem } from "@blinkdisk/ui/sidebar";
import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

export function SidebarUpdateAlert() {
  const { t } = useAppTranslation("sidebar.updateAlert");
  const { status } = useUpdateStatus();
  const [failed, setFailed] = useState(false);

  return (
    <SidebarMenuItem>
      <Alert variant="info" className="rounded-xl p-4">
        <AlertTitle>{t("title", { version: status?.version })}</AlertTitle>
        <AlertDescription className="mt-0.5 text-sm">
          {failed ? <span role="alert">{t("error")}</span> : null}
          <Button
            className="mt-2.5 w-full"
            size="sm"
            onClick={() => {
              setFailed(false);
              void window.electron.update
                .openReleases()
                .catch(() => setFailed(true));
            }}
          >
            <ExternalLinkIcon />
            {t("button")}
          </Button>
        </AlertDescription>
      </Alert>
    </SidebarMenuItem>
  );
}
