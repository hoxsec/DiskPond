import { useVaultList } from "@desktop/hooks/queries/use-vault-list";
import { useCreateVaultDialog } from "@desktop/hooks/state/use-create-vault-dialog";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Button } from "@diskpond/ui/button";
import { PlusIcon } from "lucide-react";
import { VaultCard } from "../vaults/card";
import { HealthCard } from "./health-card";
import { AccountOverviewCards } from "./overview-cards";

export function AccountHome() {
  const { t } = useAppTranslation("vault.home");
  const { openCreateVault, openConnectVault } = useCreateVaultDialog();
  const { data: vaults } = useVaultList();
  return (
    <div className="@container flex min-h-full flex-col overflow-y-auto p-6">
      <div className="mb-8 flex flex-row gap-6">
        <HealthCard isLoading={vaults === undefined} vaults={vaults} />
      </div>
      <AccountOverviewCards vaults={vaults} />
      <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("count", { count: vaults?.length ?? 0 })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={openConnectVault}>
            {t("connectVault")}
          </Button>
          <Button onClick={() => openCreateVault()}>
            <PlusIcon />
            {t("createVault")}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4">
        {vaults?.map((vault) => (
          <VaultCard key={vault.id} vault={vault} />
        ))}
      </div>
    </div>
  );
}
