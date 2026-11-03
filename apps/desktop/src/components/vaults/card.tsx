import { resolveStorageProviderType } from "@blinkdisk/constants/providers";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type { ZVaultType } from "@blinkdisk/schemas/vault";
import { cn } from "@blinkdisk/utils/class";
import { providerIcons } from "@desktop/components/icons/providers/index";
import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

type VaultCardProps = {
  vault: ZVaultType;
};

export function VaultCard({ vault }: VaultCardProps) {
  const displayProviderType = resolveStorageProviderType(vault.provider);
  const Icon = providerIcons[displayProviderType];
  const { t } = useAppTranslation("vault");
  const { status, isLoading } = useVaultStatus(vault.id);
  const displayStatus = isLoading ? "STARTING" : (status ?? "STARTING");

  return (
    <Link
      to="/$accountId/$vaultId"
      from="/$accountId"
      params={(params) => ({ ...params, vaultId: vault.id })}
      className="group flex min-w-0 flex-col border bg-card text-card-foreground outline-none transition-colors hover:border-input hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex min-w-0 items-center gap-4 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center border bg-muted">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold" title={vault.name}>
            {vault.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(`providers.${displayProviderType}.shortName`)}
          </p>
        </div>
        <ArrowRightIcon
          className="size-4 shrink-0 text-muted-foreground group-hover:text-primary group-focus-visible:text-primary"
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center gap-2 border-t px-5 py-3">
        <VaultStatusIndicator
          loading={isLoading}
          status={displayStatus}
          label={t(`status.${displayStatus}`)}
        />
        <p className={cn("text-sm", getVaultStatusTextClass(displayStatus))}>
          {t(`status.${displayStatus}`)}
        </p>
      </div>
    </Link>
  );
}

type VaultStatusIndicatorProps = {
  loading: boolean;
  status?: "SETUP" | "STARTING" | "RUNNING" | "FAILED";
  label: string;
};

function getVaultStatusTextClass(
  status?: "SETUP" | "STARTING" | "RUNNING" | "FAILED",
) {
  switch (status) {
    case "RUNNING":
      return "text-success";
    case "SETUP":
      return "text-warning";
    case "FAILED":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function VaultStatusIndicator({
  loading,
  status,
  label,
}: VaultStatusIndicatorProps) {
  const pending = loading || status === "STARTING";

  return (
    <div
      aria-label={label}
      role="img"
      title={label}
      className={cn(
        "size-2 shrink-0 transition-colors",
        status === "RUNNING" && "bg-success",
        status === "SETUP" && "bg-warning",
        status === "FAILED" && "bg-destructive",
        (!status || status === "STARTING") && "bg-muted-foreground",
        pending && "motion-safe:animate-pulse",
      )}
    />
  );
}
