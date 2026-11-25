import { CreateVaultDialog } from "@desktop/components/dialogs/create-vault/index";
import { DeleteVaultDialog } from "@desktop/components/dialogs/delete-vault";
import { CompactNavigation } from "@desktop/components/sidebar/compact-navigation";
import { Sidebar } from "@desktop/components/sidebar/index";
import { PasswordStorageNotice } from "@desktop/components/vaults/password-storage-notice";
import { SidebarInset } from "@diskpond/ui/sidebar";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type LayoutProps = {
  children?: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const page = useRouterState({
    select: (state) => state.matches.at(-1)?.routeId,
  });
  return (
    <>
      <Sidebar />
      <CreateVaultDialog />
      <DeleteVaultDialog />
      <SidebarInset className="!overflow-hidden max-md:h-svh">
        <CompactNavigation />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {page !== "/$accountId/settings" ? (
            <div className="empty:hidden px-6 pt-4">
              <PasswordStorageNotice />
            </div>
          ) : null}
          {children}
        </div>
      </SidebarInset>
    </>
  );
}
