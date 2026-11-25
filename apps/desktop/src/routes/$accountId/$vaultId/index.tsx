import { VaultOverview } from "@desktop/components/vaults/overview";
import { useVault } from "@desktop/hooks/queries/use-vault";
import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/$accountId/$vaultId/")({
  validateSearch: z.object({ suggestedFolders: z.literal(true).optional() }),
  component: RouteComponent,
});

function RouteComponent() {
  const { data: vault } = useVault();
  const { status } = useVaultStatus();

  return <VaultOverview vault={status === "RUNNING" ? vault : undefined} />;
}
