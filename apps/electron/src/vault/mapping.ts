import { getStorageProvider } from "@blinkdisk/constants/providers";
import { ZDiskPondCloudConfig } from "@blinkdisk/schemas/providers";

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

  if (provider.type === "DISKPOND_CLOUD") {
    const parsed = ZDiskPondCloudConfig.safeParse(config);
    if (!parsed.success) throw new Error("Invalid provider configuration");
    config = { ...config, endpoint: parsed.data.endpoint };
  }

  for (const [key, value] of Object.entries(config)) {
    if (provider.type === "GOOGLE_CLOUD_STORAGE" && key === "credentials") {
      // The form stores JSON text; the engine expects a JSON object, not a
      // JSON-encoded string (gcs.Options.ServiceAccountCredentialJSON).
      try {
        const credentials: unknown =
          typeof value === "string" ? JSON.parse(value) : value;
        if (
          !credentials ||
          typeof credentials !== "object" ||
          Array.isArray(credentials)
        )
          throw new Error("Invalid credentials");
        mapped[key] = credentials;
      } catch {
        // JSON parser errors can include fragments of the private key.
        throw new Error("Invalid provider configuration");
      }
    } else if (provider.coreMapping?.[key]) {
      mapped[provider.coreMapping[key]] = value;
    } else {
      mapped[key] = value;
    }
  }

  return mapped;
}
