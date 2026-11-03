import { Logo } from "@blinkdisk/components/logo";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@blinkdisk/ui/dropdown-menu";
import { Link, useParams } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";

export function CompactNavigation() {
  const { t } = useAppTranslation("sidebar.links");
  const { vaultId } = useParams({ strict: false });

  return (
    <nav
      aria-label={t("navigation")}
      className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-sidebar p-3 md:hidden"
    >
      <Link to="/$accountId" from="/$accountId">
        <Logo className="h-10" />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="secondary" size="sm">
              <MenuIcon />
              {t("navigation")}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem
            render={<Link to="/$accountId" from="/$accountId" />}
          >
            {t("home")}
          </DropdownMenuItem>
          {vaultId ? (
            <>
              <DropdownMenuItem
                render={
                  <Link to="/$accountId/$vaultId" from="/$accountId/$vaultId" />
                }
              >
                {t("overview")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    to="/$accountId/$vaultId/policies"
                    from="/$accountId/$vaultId"
                  />
                }
              >
                {t("policies")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    to="/$accountId/$vaultId/settings"
                    from="/$accountId/$vaultId"
                  />
                }
              >
                {t("vaultSettings")}
              </DropdownMenuItem>
            </>
          ) : null}
          {!vaultId ? (
            <DropdownMenuItem
              render={<Link to="/$accountId/activity" from="/$accountId" />}
            >
              {t("activity")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            render={<Link to="/$accountId/settings" from="/$accountId" />}
          >
            {t("settings")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
