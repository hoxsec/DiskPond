import { UpdateAction } from "@desktop/components/settings/update-action";
import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Alert, AlertDescription, AlertTitle } from "@diskpond/ui/alert";
import { SidebarMenuItem } from "@diskpond/ui/sidebar";

export function SidebarUpdateAlert() {
  const { t } = useAppTranslation("sidebar.updateAlert");
  const { status } = useUpdateStatus();

  return (
    <SidebarMenuItem>
      <Alert variant="info" className="rounded-xl p-4">
        <AlertTitle>{t("title", { version: status?.version })}</AlertTitle>
        <AlertDescription className="mt-0.5 text-sm">
          <UpdateAction compact />
        </AlertDescription>
      </Alert>
    </SidebarMenuItem>
  );
}
