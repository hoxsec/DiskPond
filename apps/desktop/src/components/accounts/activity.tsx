import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { BackupActivityCalendar } from "@desktop/components/history/activity-calendar";
import { useVaultList } from "@desktop/hooks/queries/use-vault-list";

export function AccountActivity() {
  const { t } = useAppTranslation("history");
  const { data: vaults } = useVaultList();

  return (
    <div className="min-w-0 p-6">
      {vaults ? (
        <BackupActivityCalendar vaults={vaults} />
      ) : (
        <p role="status">{t("loading")}</p>
      )}
    </div>
  );
}
