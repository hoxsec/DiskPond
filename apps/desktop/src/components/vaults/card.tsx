import { providerIcons } from "@desktop/components/icons/providers/index";
import { VaultCardStorage } from "@desktop/components/vaults/card-storage";
import { useVaultHealth } from "@desktop/hooks/queries/use-backup-health";
import { useVaultConfig } from "@desktop/hooks/queries/use-vault-config";
import { useVaultStatus } from "@desktop/hooks/queries/use-vault-status";
import { useAppStorage } from "@desktop/hooks/use-app-storage";
import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useRelativeTime } from "@desktop/hooks/use-relative-time";
import {
  defaultVaultColor,
  vaultBackupState,
  vaultColorClasses,
  vaultLocation,
} from "@desktop/lib/vault-card";
import { resolveStorageProviderType } from "@diskpond/constants/providers";
import { VAULT_COLORS, type VaultColor } from "@diskpond/constants/vault-color";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { ZVaultType } from "@diskpond/schemas/vault";
import { Button } from "@diskpond/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@diskpond/ui/dropdown-menu";
import { Skeleton } from "@diskpond/ui/skeleton";
import { cn } from "@diskpond/utils/class";
import { showErrorToast } from "@diskpond/utils/error-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ClockIcon,
  FolderIcon,
  PaletteIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useId } from "react";

type VaultCardProps = {
  vault: ZVaultType;
};

export function VaultCard({ vault }: VaultCardProps) {
  const displayProviderType = resolveStorageProviderType(vault.provider);
  const Icon = providerIcons[displayProviderType];
  const { t, language } = useAppTranslation("vault");
  const titleId = useId();
  const connection = useVaultStatus(vault.id);
  const healthQuery = useVaultHealth(vault.id);
  const config = useVaultConfig(vault.id);
  const health =
    connection.running && !connection.isError && !healthQuery.isError
      ? healthQuery.data
      : undefined;
  const relativeTime = useRelativeTime(health?.latestBackup);
  const [colors, setColors] = useAppStorage("preferences.vaultColors", {});
  const savedColor = colors?.[vault.id];
  const color =
    savedColor && VAULT_COLORS.includes(savedColor)
      ? savedColor
      : defaultVaultColor(vault.provider);
  const location =
    vaultLocation(config.data) ||
    t(`providers.${displayProviderType}.shortName`);
  const loading =
    connection.isPending || (connection.running && healthQuery.isPending);
  const state = vaultBackupState(
    connection.status,
    health,
    loading,
    connection.isError || (connection.running && healthQuery.isError),
  );
  const statusColor =
    state === "current"
      ? "text-success"
      : state === "offline" || state === "issues"
        ? "text-destructive"
        : ["new", "stale", "setup"].includes(state)
          ? "text-orange-700 dark:text-orange-400"
          : "text-muted-foreground";
  const { queryKeys } = useQueryKey();
  const queryClient = useQueryClient();
  const reconnect = useMutation({
    mutationFn: () => window.electron.vault.retry(vault.id),
    onError: showErrorToast,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.vault.status(vault.id),
        }),
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.source.all, "health", vault.id],
        }),
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.backup.all, "overview", vault.id],
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.vault.storageSpace(vault.id),
        }),
      ]),
  });
  async function changeColor(value: VaultColor) {
    try {
      await setColors({ ...colors, [vault.id]: value });
    } catch (error) {
      showErrorToast(error);
    }
  }

  return (
    <article
      aria-labelledby={titleId}
      data-slot="vault-card"
      data-vault-id={vault.id}
      data-vault-color={color}
      className={cn(
        "flex min-w-0 flex-col border bg-card text-card-foreground transition-colors hover:border-input",
        vaultColorClasses[color],
      )}
    >
      <div className="flex-1 p-5">
        <div className="flex items-center gap-3">
          <Link
            to="/$accountId/$vaultId"
            from="/$accountId"
            params={(params) => ({ ...params, vaultId: vault.id })}
            className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className="flex size-11 shrink-0 items-center justify-center border border-(--vault-color)/20 bg-(--vault-bg) text-(--vault-color)"
              title={t(`providers.${displayProviderType}.name`)}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="truncate text-sm font-semibold"
                title={vault.name}
              >
                {vault.name}
              </h2>
              <p
                className="mt-1 truncate text-xs text-muted-foreground"
                title={location}
              >
                {config.isPending ? <Skeleton width="80%" /> : location}
              </p>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
              className="shrink-0 text-muted-foreground"
              aria-label={t("card.changeColor", { name: vault.name })}
              title={t("card.changeColor", { name: vault.name })}
            >
              <PaletteIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {VAULT_COLORS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={color === option}
                  onCheckedChange={() => changeColor(option)}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-3 bg-(--vault-color)",
                      vaultColorClasses[option],
                    )}
                  />
                  {t(`card.colors.${option}`)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <VaultCardStorage
          vaultId={vault.id}
          running={connection.running && !connection.isError}
        />
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span
            className="inline-flex min-w-0 items-center gap-1.5"
            title={
              health?.latestBackup
                ? `${t("card.lastBackup")}: ${new Date(health.latestBackup).toLocaleString(language)}`
                : t("card.lastBackup")
            }
          >
            <ClockIcon aria-hidden="true" className="size-3.5 shrink-0" />
            {loading ? (
              <Skeleton width={75} />
            ) : health?.latestBackup ? (
              <time dateTime={health.latestBackup}>
                <span className="sr-only">{t("card.lastBackup")}: </span>
                {relativeTime}
              </time>
            ) : health ? (
              t("card.never")
            ) : (
              "—"
            )}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FolderIcon aria-hidden="true" className="size-3.5 shrink-0" />
            {loading ? (
              <Skeleton width={65} />
            ) : health ? (
              t(
                health.folderCount === health.sourceCount
                  ? "card.folders"
                  : "card.sources",
                { count: health.sourceCount },
              )
            ) : (
              t("card.sourcesUnknown")
            )}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-5 py-3 text-xs">
        <span
          className={cn("inline-flex items-center gap-2", statusColor)}
          title={
            state === "stale" || state === "current"
              ? t("overview.score.hints.freshness")
              : undefined
          }
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full bg-current",
              ["checking", "uploading", "queued"].includes(state) &&
                "motion-safe:animate-pulse",
            )}
          />
          {t(`card.status.${state}`)}
        </span>
        {connection.status === "FAILED" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-1 text-xs text-orange-700 dark:text-orange-400"
            loading={reconnect.isPending}
            disabled={reconnect.isPending}
            onClick={() => reconnect.mutate()}
          >
            {t("card.reconnect")}
            <RefreshCwIcon className="size-3.5" />
          </Button>
        ) : (
          <Link
            to="/$accountId/$vaultId"
            from="/$accountId"
            params={(params) => ({ ...params, vaultId: vault.id })}
            className="inline-flex items-center gap-2 py-1 font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("card.open")}
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </Link>
        )}
      </div>
    </article>
  );
}
