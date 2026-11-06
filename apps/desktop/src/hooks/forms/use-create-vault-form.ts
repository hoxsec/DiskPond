import {
  type CreateVaultResponse,
  useAddVault,
} from "@desktop/hooks/mutations/use-add-vault";
import { connectionErrorKey } from "@desktop/lib/vault-connection";
import {
  resolveStorageProviderType,
  type StorageProviderType,
} from "@diskpond/constants/providers";
import { useAppForm } from "@diskpond/forms/use-app-form";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { ProviderConfig } from "@diskpond/schemas/providers";
import { ZCreateVaultDetails } from "@diskpond/schemas/vault";
import { getErrorCode } from "@diskpond/utils/error";
import { useState } from "react";
import { z } from "zod";

export function useCreateVaultForm({
  providerType,
  onSuccess,
  config,
  intent,
  setBusy,
}: {
  providerType?: StorageProviderType;
  onSuccess?: (res: CreateVaultResponse) => void;
  config?: ProviderConfig;
  intent: "CREATE" | "CONNECT";
  setBusy: (busy: boolean) => void;
}) {
  const { t } = useAppTranslation("vault");
  const [error, setError] = useState<string>();

  const { mutateAsync } = useAddVault(intent, (res) => {
    onSuccess?.(res);
  });
  const displayProviderType = providerType
    ? resolveStorageProviderType(providerType)
    : undefined;

  const form = useAppForm({
    defaultValues: {
      name: displayProviderType
        ? t(`providers.${displayProviderType}.name`)
        : "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit:
        intent === "CREATE"
          ? ZCreateVaultDetails.refine(
              (value) => value.password === value.confirmPassword,
              { path: ["confirmPassword"], message: "password_mismatch" },
            )
          : ZCreateVaultDetails.extend({ confirmPassword: z.string() }),
    },
    onSubmitInvalid: ({ formApi }) => {
      const first = ["name", "password", "confirmPassword"] as const;
      const name = first.find(
        (name) => formApi.getFieldMeta(name)?.errors.length,
      );
      if (name) document.getElementById(name)?.focus();
    },
    onSubmit: async ({ value }) => {
      if (!providerType) return;
      setError(undefined);
      setBusy(true);
      try {
        await mutateAsync({
          name: value.name,
          provider: providerType,
          config: config || {},
          password: value.password,
        });
      } catch (error) {
        setError(
          t(`connectionErrors.${connectionErrorKey(getErrorCode(error))}`),
        );
      } finally {
        setBusy(false);
      }
    },
  });

  return { form, error };
}
