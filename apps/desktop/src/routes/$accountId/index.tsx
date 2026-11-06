import { AccountHome } from "@desktop/components/accounts/home";
import { Empty } from "@desktop/components/empty";
import { useVaultList } from "@desktop/hooks/queries/use-vault-list";
import { useCreateVaultDialog } from "@desktop/hooks/state/use-create-vault-dialog";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Button } from "@diskpond/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { HardDriveIcon, PlusIcon } from "lucide-react";

export const Route = createFileRoute("/$accountId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useAppTranslation("vault");
  const { openCreateVault, openConnectVault } = useCreateVaultDialog();
  const { data: vaults } = useVaultList();

  if (!vaults?.length)
    return (
      <Empty
        title={t("noVaults.title")}
        description={t("noVaults.description")}
        icon={<HardDriveIcon />}
      >
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => openCreateVault()} size="lg">
            <PlusIcon /> {t("home.createVault")}
          </Button>
          <Button onClick={openConnectVault} variant="secondary" size="lg">
            {t("home.connectVault")}
          </Button>
        </div>
      </Empty>
    );
  return <AccountHome />;
}
