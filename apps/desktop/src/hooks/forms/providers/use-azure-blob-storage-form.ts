import {
  useConfigValidation,
  type VaultAction,
} from "@desktop/hooks/use-config-validation";
import { useAppForm } from "@diskpond/forms/use-app-form";
import {
  ZAzureBlobStorageConfig,
  type ZAzureBlobStorageConfigType,
} from "@diskpond/schemas/providers";

export function useAzureBlobStorageForm({
  action,
  config,
  onSubmit,
}: {
  action: VaultAction;
  config?: ZAzureBlobStorageConfigType;
  onSubmit: (value: ZAzureBlobStorageConfigType) => void;
}) {
  const { onSubmitAsync } = useConfigValidation("AZURE_BLOB_STORAGE", action);

  return useAppForm({
    defaultValues: {
      container: "",
      account: "",
      key: "",
      domain: "",
      sasToken: "",
      prefix: "",
      ...config,
    } as ZAzureBlobStorageConfigType,
    validators: {
      onSubmit: ZAzureBlobStorageConfig,
      onSubmitAsync,
    },
    onSubmit: ({ value }) => onSubmit(value),
  });
}
