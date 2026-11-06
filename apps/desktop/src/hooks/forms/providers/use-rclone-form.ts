import {
  useConfigValidation,
  type VaultAction,
} from "@desktop/hooks/use-config-validation";
import { useAppForm } from "@diskpond/forms/use-app-form";
import {
  ZRcloneConfig,
  type ZRcloneConfigType,
} from "@diskpond/schemas/providers";

export function useRcloneForm({
  action,
  config,
  onSubmit,
}: {
  action: VaultAction;
  config?: ZRcloneConfigType;
  onSubmit: (value: ZRcloneConfigType) => void;
}) {
  const { onSubmitAsync } = useConfigValidation("RCLONE", action);

  return useAppForm({
    defaultValues: {
      remotePath: "",
      rclonePath: "",
      ...config,
    } as ZRcloneConfigType,
    validators: {
      onSubmit: ZRcloneConfig,
      onSubmitAsync,
    },
    onSubmit: ({ value }) => {
      // Filter out empty optional fields
      const processedValue = {
        ...value,
        ...(value.rclonePath && { rclonePath: value.rclonePath }),
      };
      onSubmit(processedValue);
    },
  });
}
