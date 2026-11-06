import { useAccessibilityPreferences } from "@desktop/hooks/use-accessibility-preferences";
import { useStorageListener } from "@desktop/hooks/use-app-storage";
import { useDeeplinkListener } from "@desktop/hooks/use-deeplink-listener";
import { useShortcutListener } from "@desktop/hooks/use-shortcut-listener";
import { useTheme } from "@desktop/hooks/use-theme";
import { useUpdateListener } from "@desktop/hooks/use-update-listener";
import { i18n } from "@desktop/i18n";
import { Devtools } from "@diskpond/components/devtools";
import { useThemeListener } from "@diskpond/hooks/use-theme-listener";
import { SidebarProvider } from "@diskpond/ui/sidebar";
import { SkeletonTheme } from "@diskpond/ui/skeleton";
import { Toaster } from "@diskpond/ui/toast";
import { TooltipProvider } from "@diskpond/ui/tooltip";
import { I18nextProvider } from "@diskpond/utils/i18n";
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
  useAccessibilityPreferences();
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
            </SkeletonTheme>
          </QueryClientProvider>
        </SidebarProvider>
      </TooltipProvider>
    </I18nextProvider>
  );
}
