import {
  getStorageProvider,
  resolveStorageProviderType,
} from "@blinkdisk/constants/providers";
import { mapConfigFields, mapProviderType } from "@electron/vault/mapping";

describe("mapProviderType", () => {
  it("maps standard provider types to core types", () => {
    expect(mapProviderType("INTERNAL_DRIVE")).toBe("filesystem");
    expect(mapProviderType("EXTERNAL_DRIVE")).toBe("filesystem");
    expect(mapProviderType("NETWORK_DRIVE")).toBe("filesystem");
    expect(mapProviderType("FILESYSTEM")).toBe("filesystem");
    expect(mapProviderType("NETWORK_ATTACHED_STORAGE")).toBe("filesystem");
    expect(mapProviderType("AMAZON_S3")).toBe("s3");
    expect(mapProviderType("S3_COMPATIBLE")).toBe("s3");
    expect(mapProviderType("DISKPOND_CLOUD")).toBe("s3");
    expect(mapProviderType("GOOGLE_CLOUD_STORAGE")).toBe("gcs");
    expect(mapProviderType("BACKBLAZE")).toBe("b2");
    expect(mapProviderType("AZURE_BLOB_STORAGE")).toBe("azureBlob");
    expect(mapProviderType("SFTP")).toBe("sftp");
    expect(mapProviderType("RCLONE")).toBe("rclone");
    expect(mapProviderType("WEBDAV")).toBe("webdav");
  });

  it.each([
    "CLOUDBLINK",
    "BLINKDISK_CLOUD",
    "BLINKCLOUD",
  ])("rejects retired managed storage, including alias %s", (provider) => {
    expect(() => mapProviderType(provider)).toThrow(
      "Unsupported storage provider",
    );
    expect(() => mapConfigFields(provider, {})).toThrow(
      "Unsupported storage provider",
    );
  });

  it("throws for unknown provider", () => {
    expect(() => mapProviderType("UNKNOWN")).toThrow(
      "Unsupported storage provider",
    );
  });
});

describe("storage provider compatibility", () => {
  it("resolves deprecated local providers to their replacement providers", () => {
    expect(resolveStorageProviderType("FILESYSTEM")).toBe("INTERNAL_DRIVE");
    expect(resolveStorageProviderType("NETWORK_ATTACHED_STORAGE")).toBe(
      "NETWORK_DRIVE",
    );
    expect(getStorageProvider("FILESYSTEM")?.type).toBe("INTERNAL_DRIVE");
    expect(getStorageProvider("NETWORK_ATTACHED_STORAGE")?.type).toBe(
      "NETWORK_DRIVE",
    );
  });
});

describe("mapConfigFields", () => {
  it("maps DiskPond Cloud to S3 with a hostname and exact credentials/options", () => {
    expect(
      mapConfigFields("DISKPOND_CLOUD", {
        endpoint: "https://storage.example.test:9443/",
        bucket: "bucket",
        region: "eu-west-1",
        accessKeyId: "key",
        accessKeySecret: " exact secret ",
        sessionToken: "token",
        prefix: "backup/",
        disableTls: false,
        disableTlsVerification: false,
      }),
    ).toEqual({
      endpoint: "storage.example.test:9443",
      bucket: "bucket",
      region: "eu-west-1",
      accessKeyID: "key",
      secretAccessKey: " exact secret ",
      sessionToken: "token",
      prefix: "backup/",
      doNotUseTLS: false,
      doNotVerifyTLS: false,
    });
  });

  it("rejects invalid cloud configuration without returning credentials", () => {
    expect(() =>
      mapConfigFields("DISKPOND_CLOUD", {
        endpoint: "https://user:secret@storage.example.test",
        bucket: "bucket",
        accessKeyId: "key",
        disableTls: false,
        disableTlsVerification: false,
      }),
    ).toThrow(/^Invalid provider configuration$/);
  });

  it("maps S3-compatible fields using coreMapping", () => {
    const result = mapConfigFields("S3_COMPATIBLE", {
      endpoint: "https://s3.example.com",
      accessKeyId: "AKIA123",
      accessKeySecret: "secret",
      bucket: "my-bucket",
      region: "us-east-1",
      disableTls: true,
      disableTlsVerification: false,
    });

    expect(result).toEqual({
      endpoint: "https://s3.example.com",
      accessKeyID: "AKIA123",
      secretAccessKey: "secret",
      bucket: "my-bucket",
      region: "us-east-1",
      doNotUseTLS: true,
      doNotVerifyTLS: false,
    });
  });

  it("sends GCS credential JSON as an object while preserving other fields", () => {
    const credentials = {
      type: "service_account",
      private_key: "fixture-key",
      client_email: "fixture@example.invalid",
    };
    const result = mapConfigFields("GOOGLE_CLOUD_STORAGE", {
      bucket: "my-bucket",
      prefix: "backups/",
      credentials: JSON.stringify(credentials),
    });

    expect(result).toEqual({
      bucket: "my-bucket",
      prefix: "backups/",
      credentials,
    });
  });

  it.each([
    "secret-not-json",
    '"secret-string"',
    "null",
    "[]",
    "42",
  ])("rejects invalid GCS credentials without leaking parser input %s", (credentials) => {
    expect(() =>
      mapConfigFields("GOOGLE_CLOUD_STORAGE", { credentials }),
    ).toThrow("Invalid provider configuration");
  });

  it("maps Azure fields", () => {
    const result = mapConfigFields("AZURE_BLOB_STORAGE", {
      account: "myaccount",
      key: "mykey",
      domain: "blob.core.windows.net",
      container: "backups",
    });

    expect(result).toEqual({
      storageAccount: "myaccount",
      storageKey: "mykey",
      storageDomain: "blob.core.windows.net",
      container: "backups",
    });
  });

  it("maps Backblaze fields", () => {
    const result = mapConfigFields("BACKBLAZE", {
      keyId: "key123",
      keySecret: "secret",
      bucket: "my-bucket",
      prefix: "backups",
    });

    expect(result).toEqual({
      keyId: "key123",
      key: "secret",
      bucket: "my-bucket",
      prefix: "backups",
    });
  });

  it("maps SFTP fields", () => {
    const result = mapConfigFields("SFTP", {
      host: "example.com",
      user: "admin",
      privateKey: "ssh-rsa ...",
      knownHosts: "example.com ssh-rsa ...",
      path: "/backups",
    });

    expect(result).toEqual({
      host: "example.com",
      username: "admin",
      keyData: "ssh-rsa ...",
      knownHostsData: "example.com ssh-rsa ...",
      path: "/backups",
    });
  });

  it("throws for unknown provider", () => {
    expect(() => mapConfigFields("UNKNOWN", {})).toThrow(
      "Unsupported storage provider",
    );
  });
});
