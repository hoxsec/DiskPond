import type { StorageProviderType } from "@blinkdisk/constants/providers";
import type { ProviderConfig } from "@blinkdisk/schemas/providers";
import { providerForms } from "@desktop/components/forms/providers";
import { useMemo } from "react";

export type CreateVaultConfigProps = {
  intent: "CREATE" | "CONNECT";
  config?: ProviderConfig;
  provider: StorageProviderType | undefined;
  onSubmit: (config: ProviderConfig) => void;
};

export function CreateVaultConfig({
  config,
  provider,
  onSubmit,
  intent,
}: CreateVaultConfigProps) {
  const Form = useMemo(
    () => (provider ? providerForms[provider] : null),
    [provider],
  );

  return (
    <div className="mt-8 w-full">
      {Form && (
        <Form
          action={intent}
          // @ts-expect-error Find a better way to type this
          config={config}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
