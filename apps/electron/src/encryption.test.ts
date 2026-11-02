import { decryptVaultConfig, encryptVaultConfig } from "@electron/encryption";

describe("encryptVaultConfig / decryptVaultConfig", () => {
  it("roundtrips a simple object", async () => {
    const config = { key: "value", nested: { a: 1 } };
    const encrypted = await encryptVaultConfig({ password: "test123", config });
    const decrypted = await decryptVaultConfig({
      password: "test123",
      encrypted,
    });

    expect(decrypted).toEqual(config);
  });

  it("roundtrips an empty object", async () => {
    const encrypted = await encryptVaultConfig({
      password: "pw",
      config: {},
    });
    const decrypted = await decryptVaultConfig({ password: "pw", encrypted });

    expect(decrypted).toEqual({});
  });

  it("roundtrips a complex nested object", async () => {
    const config = {
      provider: "S3",
      credentials: {
        accessKey: "AKIA...",
        secretKey: "secret",
        region: "us-east-1",
      },
      options: { encryption: true, versioning: false },
      tags: ["backup", "production"],
    };

    const encrypted = await encryptVaultConfig({
      password: "complex-pw!@#$",
      config,
    });
    const decrypted = await decryptVaultConfig({
      password: "complex-pw!@#$",
      encrypted,
    });

    expect(decrypted).toEqual(config);
  });

  it("produces base64 strings in output", async () => {
    const encrypted = await encryptVaultConfig({
      password: "test",
      config: { a: 1 },
    });

    expect(typeof encrypted.iv).toBe("string");
    expect(typeof encrypted.salt).toBe("string");
    expect(typeof encrypted.cipher).toBe("string");

    // Base64 should only contain these characters
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    expect(encrypted.iv).toMatch(base64Regex);
    expect(encrypted.salt).toMatch(base64Regex);
    expect(encrypted.cipher).toMatch(base64Regex);
  });

  it("produces different ciphertexts for different passwords", async () => {
    const config = { key: "value" };
    const enc1 = await encryptVaultConfig({ password: "pw1", config });
    const enc2 = await encryptVaultConfig({ password: "pw2", config });

    expect(enc1.cipher).not.toBe(enc2.cipher);
  });

  it("produces different ciphertexts for same password (random IV/salt)", async () => {
    const config = { key: "value" };
    const enc1 = await encryptVaultConfig({ password: "same", config });
    const enc2 = await encryptVaultConfig({ password: "same", config });

    // Random IV and salt should produce different results
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.salt).not.toBe(enc2.salt);
  });

  it("fails to decrypt with wrong password", async () => {
    const encrypted = await encryptVaultConfig({
      password: "correct",
      config: { secret: true },
    });

    await expect(
      decryptVaultConfig({ password: "wrong", encrypted }),
    ).rejects.toThrow();
  });

  it.each([
    { iv: "x".repeat(17) },
    { salt: "x".repeat(25) },
    { cipher: "x".repeat(10_001) },
    { salt: Buffer.alloc(18).toString("base64") },
    { cipher: "e30=" },
  ])("rejects malformed or oversized envelopes before deriving a key: %j", async (invalid) => {
    const encrypted = await encryptVaultConfig({
      password: "fixture-password",
      config: { provider: "fixture" },
    });
    const derive = vi.spyOn(crypto.subtle, "deriveKey");
    try {
      await expect(
        decryptVaultConfig({
          password: "fixture-password",
          encrypted: { ...encrypted, ...invalid },
        }),
      ).rejects.toThrow("Invalid saved provider envelope");
      expect(derive).not.toHaveBeenCalled();
    } finally {
      derive.mockRestore();
    }
  });
});
