import { useDeleteVaultDialog } from "@desktop/hooks/state/use-delete-vault-dialog";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Button, type ButtonProps } from "@diskpond/ui/button";
import { UnplugIcon } from "lucide-react";

type DisconnectVaultButtonProps = Pick<
  ButtonProps,
  "aria-describedby" | "className" | "disabled" | "variant"
> & { vaultId: string | undefined };

export function DisconnectVaultButton({
  vaultId,
  ...props
}: DisconnectVaultButtonProps) {
  const { t } = useAppTranslation("vault.deleteDialog");
  const { openDeleteVaultDialog } = useDeleteVaultDialog();
  if (!vaultId) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="destructive-secondary"
      {...props}
      onClick={() => openDeleteVaultDialog({ vaultId })}
    >
      <UnplugIcon aria-hidden="true" />
      {t("continue")}
    </Button>
  );
}
