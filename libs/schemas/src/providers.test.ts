import {
  ZAmazonS3Config,
  ZDiskPondCloudConfig,
  ZFilesystemConfig,
  ZProviderType,
  ZS3CompatibleConfig,
  ZSftpConfig,
  ZWebDavConfig,
} from "@schemas/providers";

describe("provider schemas", () => {
  it("accepts supported provider types and rejects unknown values", () => {
    expect(ZProviderType.safeParse("CLOUDBLINK").success).toBe(true);
    expect(ZProviderType.safeParse("DISKPOND_CLOUD").success).toBe(true);
    expect(ZProviderType.safeParse("DROPBOX").success).toBe(false);
  });

  it("enforces required filesystem path", () => {
    expect(ZFilesystemConfig.safeParse({ path: "/data" }).success).toBe(true);
    expect(ZFilesystemConfig.safeParse({ path: "" }).success).toBe(false);
  });

  it("requires Amazon S3 region and base credentials", () => {
    expect(
      ZAmazonS3Config.safeParse({
        endpoint: "https://s3.amazonaws.com",
        bucket: "bucket",
        accessKeyId: "key",
        region: "eu-central-1",
      }).success,
    ).toBe(true);

    expect(
      ZAmazonS3Config.safeParse({
        endpoint: "https://s3.amazonaws.com",
        bucket: "bucket",
        accessKeyId: "key",
      }).success,
    ).toBe(false);
  });

  it("requires explicit S3-compatible TLS flags", () => {
    expect(
      ZS3CompatibleConfig.safeParse({
        endpoint: "https://example.com",
        bucket: "bucket",
        accessKeyId: "key",
        disableTls: false,
        disableTlsVerification: false,
      }).success,
    ).toBe(true);

    expect(
      ZS3CompatibleConfig.safeParse({
        endpoint: "https://example.com",
        bucket: "bucket",
        accessKeyId: "key",
      }).success,
    ).toBe(false);
  });

  it("checks SFTP port and known-hosts requirements", () => {
    expect(
      ZSftpConfig.safeParse({
        host: "example.com",
        user: "backup",
        port: 22,
        path: "/backups",
        knownHosts: "example.com ssh-ed25519 key",
      }).success,
    ).toBe(true);

    expect(
      ZSftpConfig.safeParse({
        host: "example.com",
        user: "backup",
        port: 70000,
        path: "/backups",
        knownHosts: "example.com ssh-ed25519 key",
      }).success,
    ).toBe(false);
  });

  it("requires a valid WebDAV URL", () => {
    expect(
      ZWebDavConfig.safeParse({ url: "https://example.com/dav" }).success,
    ).toBe(true);
    expect(ZWebDavConfig.safeParse({ url: "not-a-url" }).success).toBe(false);
  });
});

describe("DiskPond Cloud endpoints", () => {
  const config = {
    endpoint: "storage.example.test",
    bucket: "bucket",
    accessKeyId: "key",
    accessKeySecret: "secret",
    sessionToken: "token",
    prefix: "backups/",
    region: "eu-west-1",
    disableTls: false,
    disableTlsVerification: false,
  };

  it.each([
    ["storage.example.test", "storage.example.test"],
    [" https://storage.example.test/ ", "storage.example.test"],
    ["HTTPS://storage.example.test", "storage.example.test"],
    ["https://storage.example.test:9443/", "storage.example.test:9443"],
    ["storage.example.test:9443", "storage.example.test:9443"],
    ["https://[::1]:9443/", "[::1]:9443"],
  ])("normalizes %s without changing other settings", (endpoint, host) => {
    expect(ZDiskPondCloudConfig.parse({ ...config, endpoint })).toEqual({
      ...config,
      endpoint: host,
    });
  });

  it.each([
    "http://storage.example.test",
    "https://user:secret@storage.example.test",
    "https://storage.example.test/bucket",
    "https://storage.example.test/bucket/..",
    "https://storage.example.test?token=secret",
    "https://storage.example.test#fragment",
    "https://storage.example.test\\bucket",
    "https://",
    "ftp://storage.example.test",
    "storage.example.test:65536",
    "storage.example.test extra",
  ])("rejects unsafe or ambiguous endpoint %s", (endpoint) => {
    const parsed = ZDiskPondCloudConfig.safeParse({ ...config, endpoint });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues[0]?.path).toEqual(["endpoint"]);
  });

  it("requires explicit HTTP and preserves explicit TLS options", () => {
    expect(
      ZDiskPondCloudConfig.parse({
        ...config,
        endpoint: "http://storage.example.test:9000/",
        disableTls: true,
        disableTlsVerification: true,
      }),
    ).toEqual({
      ...config,
      endpoint: "storage.example.test:9000",
      disableTls: true,
      disableTlsVerification: true,
    });
    expect(
      ZDiskPondCloudConfig.safeParse({
        ...config,
        endpoint: "https://storage.example.test",
        disableTls: true,
      }).success,
    ).toBe(false);
  });
});
