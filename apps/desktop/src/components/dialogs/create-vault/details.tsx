import type { StorageProviderType } from "@blinkdisk/constants/providers";
import { FormDisabledContext, useStore } from "@blinkdisk/forms/use-app-form";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import { Alert, AlertDescription, AlertTitle } from "@blinkdisk/ui/alert";
import { PasswordStorageNotice } from "@desktop/components/vaults/password-storage-notice";
import { useCreateVaultForm } from "@desktop/hooks/forms/use-create-vault-form";
import { useAccountId } from "@desktop/hooks/use-account-id";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangleIcon } from "lucide-react";
import { useEffect, useRef } from "react";

type CreateVaultDetailsProps = {
  intent: "CREATE" | "CONNECT";
  setBusy: (busy: boolean) => void;
  providerType?: StorageProviderType;
  onSubmit?: () => void;
  config?: ProviderConfig;
};

function getPasswordScore(password: string) {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z\d]/.test(password)) score++;

  return Math.min(score, 4);
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const score = getPasswordScore(password);
  const activeBars = password ? Math.max(score, 1) : 0;
  const colors = [
    "bg-muted",
    "bg-destructive",
    "bg-warning",
    "bg-info",
    "bg-success",
  ];

  return (
    <div aria-hidden="true" className="flex h-1 gap-1">
      {[1, 2, 3, 4].map((bar) => (
        <div
          className={`flex-1 rounded-full transition-colors ${bar <= activeBars ? colors[activeBars] : colors[0]}`}
          key={bar}
        />
      ))}
    </div>
  );
}

export function CreateVaultDetails({
  providerType,
  onSubmit,
  config,
  intent,
  setBusy,
}: CreateVaultDetailsProps) {
  const { t } = useAppTranslation("vault.createDialog.details");
  const { accountId } = useAccountId();

  const navigate = useNavigate({ from: "/$accountId" });

  const { form, error } = useCreateVaultForm({
    intent,
    setBusy,
    config,
    providerType,
    onSuccess: async (res) => {
      if (!accountId) return;

      await navigate({
        to: "/$accountId/$vaultId",
        params: (params) => ({
          ...params,
          vaultId: res.vaultId,
        }),
      });

      onSubmit?.();
    },
  });

  const values = useStore(form.store, (store) => store.values);
  const submitting = useStore(form.store, (store) => store.isSubmitting);
  const errorPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorPanel.current?.focus();
  }, [error]);

  return (
    <FormDisabledContext.Provider value={submitting}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(e);
        }}
        className="mt-8 flex flex-col gap-6"
      >
        <form.AppField name="name">
          {(field) => (
            <field.Text
              label={{ title: t("name.label"), required: true }}
              placeholder={t("name.placeholder")}
            />
          )}
        </form.AppField>
        <div className="flex flex-col gap-2">
          <form.AppField name="password">
            {(field) => (
              <field.Password
                autoComplete={
                  intent === "CREATE" ? "new-password" : "current-password"
                }
                label={{ title: t("password.label"), required: true }}
                placeholder={t("password.placeholder")}
              />
            )}
          </form.AppField>
          {intent === "CREATE" ? (
            <PasswordStrengthMeter password={values.password || ""} />
          ) : null}
        </div>
        {intent === "CREATE" ? (
          <>
            <form.AppField
              name="confirmPassword"
              validators={{
                onBlur: ({ value, fieldApi }) => {
                  if (value !== fieldApi.form.getFieldValue("password"))
                    return { code: "custom", message: "password_mismatch" };

                  return undefined;
                },
              }}
            >
              {(field) => (
                <field.Password
                  autoComplete="new-password"
                  label={{ title: t("confirmPassword.label"), required: true }}
                  placeholder={t("confirmPassword.placeholder")}
                />
              )}
            </form.AppField>
            <Alert className="border-warning/30 bg-warning/5 text-warning">
              <AlertTriangleIcon />
              <AlertTitle>{t("warning.title")}</AlertTitle>
              <AlertDescription className="text-warning text-xs">
                {t("warning.description")}
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{t("connectHint")}</p>
        )}
        <PasswordStorageNotice />
        {error ? (
          <Alert variant="destructive" ref={errorPanel} tabIndex={-1}>
            <AlertTriangleIcon />
            <AlertTitle>{t("failed")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <p role="status" className="sr-only">
          {submitting ? t(intent === "CREATE" ? "creating" : "connecting") : ""}
        </p>
        <form.AppForm>
          <form.Submit>
            {t(intent === "CREATE" ? "submit" : "connect")}
          </form.Submit>
        </form.AppForm>
      </form>
    </FormDisabledContext.Provider>
  );
}
