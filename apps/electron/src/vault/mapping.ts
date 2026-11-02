import { getStorageProvider } from "@blinkdisk/constants/providers";

export function mapProviderType(providerType: string) {
  const provider = getStorageProvider(providerType);
  if (!provider || provider.type === "CLOUDBLINK")
    throw new Error("Unsupported storage provider");
  return provider.coreType;
}

export function mapConfigFields(
  providerType: string,
  config: Record<string, unknown>,
) {
  const provider = getStorageProvider(providerType);
  if (!provider || provider.type === "CLOUDBLINK")
    throw new Error("Unsupported storage provider");

  const mapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (provider.coreMapping?.[key]) {
      mapped[provider.coreMapping[key]] = value;
    } else {
      mapped[key] = value;
    }
  }

  return mapped;
}
