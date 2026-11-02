import { SidebarInset } from "@blinkdisk/ui/sidebar";
import { CreateVaultDialog } from "@desktop/components/dialogs/create-vault/index";
import { CompactNavigation } from "@desktop/components/sidebar/compact-navigation";
import { Sidebar } from "@desktop/components/sidebar/index";
import type { ReactNode } from "react";

export type LayoutProps = {
  children?: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <Sidebar />
      <CreateVaultDialog />
      <SidebarInset className="!overflow-hidden max-md:h-svh">
        <CompactNavigation />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
