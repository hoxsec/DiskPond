import { Logo } from "@blinkdisk/components/logo";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import {
  Sidebar as SidebarContainer,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@blinkdisk/ui/sidebar";
import { SidebarAlerts } from "@desktop/components/sidebar/alerts";
import { SidebarSkeletonTheme } from "@desktop/components/sidebar/skeleton-theme";
import { VaultMenuDropdown } from "@desktop/components/vaults/menu-dropdown";
import { VaultPreview } from "@desktop/components/vaults/preview";
import { useVault } from "@desktop/hooks/queries/use-vault";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  FileCogIcon,
  HomeIcon,
  LayoutDashboardIcon,
  SettingsIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

export function Sidebar({ ...props }: ComponentProps<typeof SidebarContainer>) {
  const { data: vault } = useVault();

  const { accountId, vaultId } = useParams({
    strict: false,
  });

  const { t } = useAppTranslation("sidebar.links");

  const pathname = useLocation({
    select: ({ pathname }) => pathname,
  });

  if (!accountId) return null;

  const vaultPath =
    accountId && vaultId ? `/${accountId}/${vaultId}` : undefined;
  const settingsPath = vaultPath ? `${vaultPath}/settings` : undefined;
  const policiesPath = vaultPath ? `${vaultPath}/policies` : undefined;

  return (
    <SidebarSkeletonTheme>
      <SidebarContainer variant="inset" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem className="pl-3 py-2">
              <Link to="/$accountId" from="/$accountId" tabIndex={-1}>
                <Logo />
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="flex flex-col gap-6 p-2">
          {!vaultId ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="px-3"
                  isActive={pathname === `/${accountId}`}
                  render={
                    <Link to="/$accountId" from="/$accountId">
                      <HomeIcon />
                      {t("home")}
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="px-3"
                  isActive={pathname === `/${accountId}/activity`}
                  render={
                    <Link to="/$accountId/activity" from="/$accountId">
                      <CalendarDaysIcon />
                      {t("activity")}
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="px-3"
                  isActive={pathname === `/${accountId}/settings`}
                  render={
                    <Link to="/$accountId/settings" from="/$accountId">
                      <SettingsIcon />
                      {t("settings")}
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="px-3 text-muted-foreground hover:text-foreground"
                  render={
                    <Link to="/$accountId" from="/$accountId">
                      <ArrowLeftIcon />
                      {t("home")}
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem className="mt-4">
                <VaultMenuDropdown>
                  <SidebarMenuButton className="shrink-0" size="lg">
                    {vault ? <VaultPreview vault={vault} /> : null}
                  </SidebarMenuButton>
                </VaultMenuDropdown>
              </SidebarMenuItem>
              <SidebarMenuItem className="mt-4">
                <SidebarMenuButton
                  className="px-3"
                  isActive={pathname === vaultPath}
                  render={
                    vaultId ? (
                      <Link
                        to="/$accountId/$vaultId"
                        from="/$accountId/$vaultId"
                      >
                        <LayoutDashboardIcon />
                        {t("overview")}
                      </Link>
                    ) : (
                      <span>
                        <LayoutDashboardIcon />
                        {t("overview")}
                      </span>
                    )
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="px-3"
                  isActive={pathname === policiesPath}
                  render={
                    vaultId ? (
                      <Link
                        to="/$accountId/$vaultId/policies"
                        from="/$accountId/$vaultId"
                      >
                        <FileCogIcon />
                        {t("policies")}
                      </Link>
                    ) : (
                      <span>
                        <FileCogIcon />
                        {t("policies")}
                      </span>
                    )
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="px-3"
                  isActive={pathname === settingsPath}
                  render={
                    vaultId ? (
                      <Link
                        to="/$accountId/$vaultId/settings"
                        from="/$accountId/$vaultId"
                      >
                        <SettingsIcon />
                        {t("settings")}
                      </Link>
                    ) : (
                      <span>
                        <SettingsIcon />
                        {t("settings")}
                      </span>
                    )
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu className="gap-4">
            <SidebarAlerts />
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContainer>
    </SidebarSkeletonTheme>
  );
}
