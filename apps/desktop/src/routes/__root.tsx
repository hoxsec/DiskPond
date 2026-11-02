import { Devtools } from "@blinkdisk/components/devtools";
import { useThemeListener } from "@blinkdisk/hooks/use-theme-listener";
import { SidebarProvider } from "@blinkdisk/ui/sidebar";
import { SkeletonTheme } from "@blinkdisk/ui/skeleton";
import { Toaster } from "@blinkdisk/ui/toast";
import { TooltipProvider } from "@blinkdisk/ui/tooltip";
import { I18nextProvider } from "@blinkdisk/utils/i18n";
import { UpdateDialog } from "@desktop/components/dialogs/update";
import { useStorageListener } from "@desktop/hooks/use-app-storage";
import { useDeeplinkListener } from "@desktop/hooks/use-deeplink-listener";
import { useShortcutListener } from "@desktop/hooks/use-shortcut-listener";
import { useTheme } from "@desktop/hooks/use-theme";
import { useUpdateListener } from "@desktop/hooks/use-update-listener";
import { i18n } from "@desktop/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import "react-loading-skeleton/dist/skeleton.css";

const queryClient = new QueryClient();
export const Route = createRootRoute({ component: RootComponent });

function RootComponent() {
  const theme = useTheme();
  useThemeListener(theme);
  useShortcutListener();
  useDeeplinkListener();
  useStorageListener();
  useUpdateListener();

  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <SidebarProvider>
          <QueryClientProvider client={queryClient}>
            <Devtools />
            <SkeletonTheme dark={theme.dark}>
              <Outlet />
              <Toaster dark={theme.dark} />
              <UpdateDialog />
            </SkeletonTheme>
          </QueryClientProvider>
        </SidebarProvider>
      </TooltipProvider>
    </I18nextProvider>
  );
}
