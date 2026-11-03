import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Alert, AlertDescription, AlertTitle } from "@blinkdisk/ui/alert";
import { usePasswordStorage } from "@desktop/hooks/queries/use-password-storage";
import { KeyRoundIcon } from "lucide-react";

export function PasswordStorageNotice({
  showProtected = false,
}: {
  showProtected?: boolean;
}) {
  const { t } = useAppTranslation("vault.passwordStorage");
  const { data, isError } = usePasswordStorage();
  if (!data && !isError) return null;
  const issue =
    isError ||
    data?.mode === "SESSION" ||
    data?.needsPassword ||
    data?.cleanupFailed;
  if (!showProtected && !issue) return null;
  const state = isError
    ? "unknown"
    : data?.cleanupFailed
      ? "cleanupFailed"
      : data?.mode === "SESSION"
        ? "session"
        : data?.needsPassword
          ? "locked"
          : "protected";
  return (
    <Alert role="status">
      <KeyRoundIcon aria-hidden="true" />
      <AlertTitle className="line-clamp-none">{t(`${state}.title`)}</AlertTitle>
      <AlertDescription>
        <p>{t(`${state}.description`)}</p>
        {state === "cleanupFailed" && data?.mode === "SESSION" ? (
          <p>{t("session.description")}</p>
        ) : null}
        {showProtected && state === "session" ? (
          <p>{t("session.recovery")}</p>
        ) : null}
        {data?.mode === "SESSION" && data.reason === "SAVE_FAILED" ? (
          <p>{t("saveFailed")}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
