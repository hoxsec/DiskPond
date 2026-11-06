import { ConfigValidationError } from "@desktop/components/errors/config-validation";
import { VaultExistsError } from "@desktop/components/errors/vault-exists";
import type { VaultAction } from "@desktop/hooks/use-config-validation";
import { useStore } from "@diskpond/forms/use-app-form";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { AnyFormApi } from "@tanstack/react-form";
import { useEffect, useRef } from "react";

type CreateVaultAlertsProps = {
  form: AnyFormApi;
  action: VaultAction;
};

export function CreateVaultAlerts({ form, action }: CreateVaultAlertsProps) {
  const errors = useStore(form.store, (store) => store.errorMap);
  const pending = useStore(form.store, (store) => store.isSubmitting);
  const { t } = useAppTranslation("vault.createDialog.config");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors?.onSubmit) panel.current?.focus();
  }, [errors?.onSubmit]);

  if (action === "UPDATE") return null;
  if (!errors?.onSubmit)
    return (
      <p role="status" className="sr-only">
        {pending ? t("checking") : ""}
      </p>
    );
  return (
    <div ref={panel} tabIndex={-1}>
      {errors.onSubmit.code === "VAULT_VALIDATION_FAILED" ? (
        <ConfigValidationError message={errors.onSubmit.message} />
      ) : errors.onSubmit.code === "VAULT_ALREADY_EXISTS" ? (
        <VaultExistsError name={errors.onSubmit.name} />
      ) : null}
    </div>
  );
}
