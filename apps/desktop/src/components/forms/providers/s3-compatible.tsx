import { CreateVaultAlerts } from "@desktop/components/dialogs/create-vault/alerts";
import { ProviderSubmitButton } from "@desktop/components/forms/providers/submit-button";
import { useS3CompatibleForm } from "@desktop/hooks/forms/providers/use-s3-compatible-form";
import type { VaultAction } from "@desktop/hooks/use-config-validation";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { ZS3CompatibleConfigType } from "@diskpond/schemas/providers";
import { Button } from "@diskpond/ui/button";
import { ExternalLinkIcon } from "lucide-react";

export type S3CompatibleFormProps = {
  provider?: "S3_COMPATIBLE" | "DISKPOND_CLOUD";
  action: VaultAction;
  config?: ZS3CompatibleConfigType;
  onSubmit: (config: ZS3CompatibleConfigType) => void;
};

export function S3CompatibleForm({
  provider = "S3_COMPATIBLE",
  action,
  config,
  onSubmit,
}: S3CompatibleFormProps) {
  const { t } = useAppTranslation("vault.providers.S3_COMPATIBLE.fields");
  const { t: cloudText } = useAppTranslation("vault.providers.DISKPOND_CLOUD");
  const isCloud = provider === "DISKPOND_CLOUD";

  const form = useS3CompatibleForm({
    provider,
    action,
    config,
    onSubmit,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit(e);
      }}
      className="flex w-full flex-col gap-4"
    >
      {isCloud && (
        <Button
          variant="link"
          className="self-start px-0"
          nativeButton={false}
          render={
            <a
              href="https://cloud.diskpond.com"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          {cloudText("openPortal")}
          <ExternalLinkIcon aria-hidden="true" />
        </Button>
      )}
      <form.AppField name="endpoint">
        {(field) => (
          <field.Text
            label={{ title: t("endpoint.label"), required: true }}
            placeholder={
              isCloud
                ? cloudText("endpointPlaceholder")
                : t("endpoint.placeholder")
            }
          />
        )}
      </form.AppField>
      <form.AppField name="bucket">
        {(field) => (
          <field.Text
            label={{ title: t("bucket.label"), required: true }}
            placeholder={
              isCloud ? cloudText("bucketPlaceholder") : t("bucket.placeholder")
            }
          />
        )}
      </form.AppField>
      <form.AppField name="accessKeyId">
        {(field) => (
          <field.Text
            label={{ title: t("accessKeyId.label"), required: true }}
            placeholder={t("accessKeyId.placeholder")}
          />
        )}
      </form.AppField>
      <form.AppField name="accessKeySecret">
        {(field) => (
          <field.Password
            label={{ title: t("accessKeySecret.label"), required: true }}
            placeholder={t("accessKeySecret.placeholder")}
          />
        )}
      </form.AppField>
      <form.AppField name="region">
        {(field) => (
          <field.Text
            label={{ title: t("region.label") }}
            placeholder={t("region.placeholder")}
          />
        )}
      </form.AppField>
      <form.AppField name="sessionToken">
        {(field) => (
          <field.Password
            label={{ title: t("sessionToken.label") }}
            placeholder={t("sessionToken.placeholder")}
          />
        )}
      </form.AppField>
      <form.AppField name="prefix">
        {(field) => (
          <field.Text
            label={{ title: t("prefix.label") }}
            placeholder={t("prefix.placeholder")}
          />
        )}
      </form.AppField>
      <form.AppField name="disableTls">
        {(field) => <field.Switch label={{ title: t("disableTls.label") }} />}
      </form.AppField>
      <form.AppField name="disableTlsVerification">
        {(field) => (
          <field.Switch label={{ title: t("disableTlsVerification.label") }} />
        )}
      </form.AppField>
      <CreateVaultAlerts form={form} action={action} />
      <ProviderSubmitButton action={action} form={form} />
    </form>
  );
}
