import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { AccountHome } from "@desktop/components/accounts/home";
import { Empty } from "@desktop/components/empty";
import { useVaultList } from "@desktop/hooks/queries/use-vault-list";
import { useCreateVaultDialog } from "@desktop/hooks/state/use-create-vault-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { HardDriveIcon, PlusIcon } from "lucide-react";

export const Route = createFileRoute("/$accountId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useAppTranslation("vault");
  const { openCreateVault } = useCreateVaultDialog();
  const { data: vaults } = useVaultList();

  if (!vaults?.length)
    return (
      <Empty
        title={t("noVaults.title")}
        description={t("noVaults.description")}
        icon={<HardDriveIcon />}
      >
        <Button onClick={() => openCreateVault()} size="lg">
          <PlusIcon /> {t("noVaults.add")}
        </Button>
      </Empty>
    );
  return <AccountHome />;
}
