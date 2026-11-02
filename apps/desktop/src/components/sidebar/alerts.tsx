import { SidebarUpdateAlert } from "@desktop/components/sidebar/update-alert";
import { useUpdateDialog } from "@desktop/hooks/state/use-update-dialog";

export function SidebarAlerts() {
  const { status } = useUpdateDialog();
  return status?.available ? <SidebarUpdateAlert /> : null;
}
