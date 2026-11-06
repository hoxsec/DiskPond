import {
  useConfigValidation,
  type VaultAction,
} from "@desktop/hooks/use-config-validation";
import { useAppForm } from "@diskpond/forms/use-app-form";
import {
  ZWebDavConfig,
  type ZWebDavConfigType,
} from "@diskpond/schemas/providers";

export function useWebDavForm({
  action,
  config,
  onSubmit,
}: {
  action: VaultAction;
  config?: ZWebDavConfigType;
  onSubmit: (value: ZWebDavConfigType) => void;
}) {
  const { onSubmitAsync } = useConfigValidation("WEBDAV", action);

  return useAppForm({
    defaultValues: {
      url: "",
      user: "",
      password: "",
      ...config,
    } as ZWebDavConfigType,
    validators: {
      onSubmit: ZWebDavConfig,
      onSubmitAsync,
    },
    onSubmit: ({ value }) => onSubmit(value),
  });
}
