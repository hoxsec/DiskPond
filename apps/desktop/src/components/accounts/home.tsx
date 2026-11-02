import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { useVaultList } from "@desktop/hooks/queries/use-vault-list";
import { useCreateVaultDialog } from "@desktop/hooks/state/use-create-vault-dialog";
import { PlusIcon } from "lucide-react";
import { VaultCard } from "../vaults/card";
import { HealthCard } from "./health-card";

export function AccountHome() {
  const { t } = useAppTranslation("vault.home");
  const { openCreateVault } = useCreateVaultDialog();
  const { data: vaults } = useVaultList();
  return (
    <div className="flex min-h-full flex-col overflow-y-auto p-6">
      <div className="mb-8 flex flex-row gap-6">
        <HealthCard isLoading={vaults === undefined} vaults={vaults} />
      </div>
      <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("count", { count: vaults?.length ?? 0 })}
          </p>
        </div>
        <Button onClick={() => openCreateVault()}>
          <PlusIcon />
          {t("createVault")}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4">
        {vaults?.map((vault) => (
          <VaultCard key={vault.id} vault={vault} />
        ))}
      </div>
    </div>
  );
}
