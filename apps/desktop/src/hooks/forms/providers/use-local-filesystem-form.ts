import {
  useConfigValidation,
  type VaultAction,
} from "@desktop/hooks/use-config-validation";
import {
  resolveStorageProviderType,
  type StorageProviderType,
} from "@diskpond/constants/providers";
import { useAppForm } from "@diskpond/forms/use-app-form";
import {
  ZFilesystemConfig,
  type ZFilesystemConfigType,
} from "@diskpond/schemas/providers";

export type LocalFilesystemProviderType = Extract<
  StorageProviderType,
  | "INTERNAL_DRIVE"
  | "EXTERNAL_DRIVE"
  | "NETWORK_DRIVE"
  | "FILESYSTEM"
  | "NETWORK_ATTACHED_STORAGE"
>;

export function useLocalFilesystemForm({
  action,
  config,
  onSubmit,
  providerType,
}: {
  action: VaultAction;
  config?: ZFilesystemConfigType;
  onSubmit: (value: ZFilesystemConfigType) => void;
  providerType: LocalFilesystemProviderType;
}) {
  const { onSubmitAsync } = useConfigValidation(
    resolveStorageProviderType(providerType),
    action,
  );

  return useAppForm({
    defaultValues: {
      path: "",
      ...config,
    },
    validators: {
      onSubmit: ZFilesystemConfig,
      onSubmitAsync,
    },
    onSubmit: ({ value }) => onSubmit(value),
  });
}
