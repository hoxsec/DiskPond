import { generateId, verifyId } from "./id";

describe("generateId", () => {
  it("returns a string of length 21 without prefix", () => {
    const id = generateId();
    expect(id).toHaveLength(21);
  });

  it("generates a valid id that passes verification", () => {
    const id = generateId();
    expect(verifyId(id)).toBe(true);
  });

  it("prefixes with 'vlt_' for Vault", () => {
    const id = generateId("Vault");
    expect(id).toMatch(/^vlt_/);
  });

  it("generates unique ids", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe("verifyId", () => {
  it.each([
    "acct_BmedFoXQrpnVXBKXy5MNd",
    "strg_BmedFoXQrpnVXBKXy5MNd",
  ])("accepts existing IDs with retired prefixes: %s", (id) => {
    expect(verifyId(id)).toBe(true);
  });

  it("returns true for a valid unprefixed id", () => {
    const id = generateId();
    expect(verifyId(id)).toBe(true);
  });

  it("returns true for a valid prefixed id", () => {
    const id = generateId("Vault");
    expect(verifyId(id)).toBe(true);
  });

  it("returns false for an invalid id", () => {
    expect(verifyId("totally-invalid-id!!")).toBe(false);
  });

  it("returns false for wrong length", () => {
    expect(verifyId("short")).toBe(false);
  });
});
