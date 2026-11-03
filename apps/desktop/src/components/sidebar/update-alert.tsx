import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Alert, AlertDescription, AlertTitle } from "@blinkdisk/ui/alert";
import { SidebarMenuItem } from "@blinkdisk/ui/sidebar";
import { UpdateAction } from "@desktop/components/settings/update-action";
import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";

export function SidebarUpdateAlert() {
  const { t } = useAppTranslation("sidebar.updateAlert");
  const { status } = useUpdateStatus();

  return (
    <SidebarMenuItem>
      <Alert variant="info" className="rounded-xl p-4">
        <AlertTitle>{t("title", { version: status?.version })}</AlertTitle>
        <AlertDescription className="mt-0.5 text-sm">
          <UpdateAction />
        </AlertDescription>
      </Alert>
    </SidebarMenuItem>
  );
}
