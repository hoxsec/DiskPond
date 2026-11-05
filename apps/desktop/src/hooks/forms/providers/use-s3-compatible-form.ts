import { useAppForm } from "@blinkdisk/forms/use-app-form";
import {
  ZDiskPondCloudConfig,
  ZS3CompatibleConfig,
  type ZS3CompatibleConfigType,
} from "@blinkdisk/schemas/providers";
import {
  useConfigValidation,
  type VaultAction,
} from "@desktop/hooks/use-config-validation";
import type { z } from "zod";

export function useS3CompatibleForm({
  provider = "S3_COMPATIBLE",
  action,
  config,
  onSubmit,
}: {
  provider?: "S3_COMPATIBLE" | "DISKPOND_CLOUD";
  action: VaultAction;
  config?: ZS3CompatibleConfigType;
  onSubmit: (value: ZS3CompatibleConfigType) => void;
}) {
  const { onSubmitAsync } = useConfigValidation(provider, action);
  const schema: z.ZodType<ZS3CompatibleConfigType, ZS3CompatibleConfigType> =
    provider === "DISKPOND_CLOUD" ? ZDiskPondCloudConfig : ZS3CompatibleConfig;

  return useAppForm({
    defaultValues: {
      endpoint: "",
      bucket: "",
      accessKeyId: "",
      accessKeySecret: "",
      sessionToken: "",
      prefix: "",
      region: "",
      disableTlsVerification: false,
      disableTls: false,
      ...config,
    } as ZS3CompatibleConfigType,
    validators: {
      onSubmit: schema,
      onSubmitAsync,
    },
    onSubmit: ({ value }) =>
      onSubmit(provider === "DISKPOND_CLOUD" ? schema.parse(value) : value),
  });
}
