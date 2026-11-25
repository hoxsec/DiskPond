import { CreateSourceDialog } from "@desktop/components/dialogs/create-source";
import { DeleteSourceDialog } from "@desktop/components/dialogs/delete-source";
import { EditExclusionDialog } from "@desktop/components/dialogs/edit-exclusion";
import { TaskDialog } from "@desktop/components/dialogs/task";
import { SourceDropzone } from "@desktop/components/sources/dropzone";
import { VaultFailed } from "@desktop/components/vaults/failed";
import { Setup } from "@desktop/components/vaults/setup";
import { VaultStarting } from "@desktop/components/vaults/starting";
import { useVault } from "@desktop/hooks/queries/use-vault";
import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { useAccountStorage } from "@desktop/hooks/use-account-storage";
import { useTaskbarProgress } from "@desktop/hooks/use-taskbar-progress";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

export const Route = createFileRoute("/$accountId/$vaultId")({
  component: RouteComponent,
  validateSearch: z.object({
    otherHostName: z.string().optional(),
    otherUserName: z.string().optional(),
  }),
});

function RouteComponent() {
  const { data: vault } = useVault();
  const { status } = useVaultStatus();

  useTaskbarProgress();

  const [, setLastUsedVaultId] = useAccountStorage("lastUsedVaultId");

  useEffect(() => {
    if (vault?.status !== "ACTIVE") return;
    setLastUsedVaultId(vault.id);
  }, [vault, setLastUsedVaultId]);

  if (vault?.status === "DELETED")
    return <Navigate from="/$accountId/$vaultId" to="/$accountId" replace />;

  return (
    <>
      <TaskDialog />

      {status === "STARTING" ? (
        <VaultStarting />
      ) : status === "FAILED" ? (
        <VaultFailed />
      ) : vault && status === "SETUP" ? (
        <Setup />
      ) : (
        <>
          <SourceDropzone />

          <CreateSourceDialog />
          <DeleteSourceDialog />
          <EditExclusionDialog />

          <Outlet />
        </>
      )}
    </>
  );
}
