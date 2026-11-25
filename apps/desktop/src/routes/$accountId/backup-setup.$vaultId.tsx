import { BackupSetup } from "@desktop/components/backup-setup";
import { useVault } from "@desktop/hooks/queries/use-vault";
import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/$accountId/backup-setup/$vaultId")({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: vault } = useVault(params.vaultId);
  const state = useVaultStatus(params.vaultId);
  if (vault?.status !== "ACTIVE")
    return <Navigate to="/$accountId" params={params} replace />;
  if (
    state.status === "FAILED" ||
    state.status === "SETUP" ||
    state.isError ||
    state.data === null
  )
    return <Navigate to="/$accountId/$vaultId" params={params} replace />;
  return (
    <BackupSetup
      key={vault.id}
      vault={vault}
      running={state.running}
      onExit={() =>
        navigate({ to: "/$accountId/$vaultId", params, replace: true })
      }
    />
  );
}
