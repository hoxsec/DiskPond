import { SidebarUpdateAlert } from "@desktop/components/sidebar/update-alert";
import { useUpdateStatus } from "@desktop/hooks/state/use-update-status";

export function SidebarAlerts() {
  const { status } = useUpdateStatus();
  return status?.available ? <SidebarUpdateAlert /> : null;
}
