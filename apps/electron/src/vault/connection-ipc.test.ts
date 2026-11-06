const mocks = vi.hoisted(() => {
  const frame = { url: "diskpondapp://frontend/local" };
  const contents = { mainFrame: frame };
  return {
    frame,
    contents,
    event: { sender: contents, senderFrame: frame },
    handlers: new Map<
      string,
      (event: unknown, ...args: unknown[]) => unknown
    >(),
    findOne: vi.fn((query: { id: string }) =>
      query.id === "vlt_local" ? { id: query.id } : undefined,
    ),
    saved: vi.fn(() => false),
    create: vi.fn(async () => ({})),
    connect: vi.fn(async () => ({})),
    unlock: vi.fn(async () => ({})),
    summary: vi.fn(),
    storageSpace: vi.fn(),
    validate: vi.fn(),
  };
});
vi.mock("electron", () => ({
  app: { isPackaged: true },
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, ...args: unknown[]) => unknown,
    ) => mocks.handlers.set(name, handler),
  },
}));
vi.mock("@electron/window", () => ({
  window: { webContents: mocks.contents },
}));
vi.mock("@electron/db", () => ({
  collections: { local: { vault: { findOne: mocks.findOne } } },
}));
vi.mock("@electron/vault/connection", () => ({
  hasSavedConnection: mocks.saved,
  getConnectionSummary: mocks.summary,
  getVaultStorageSpace: mocks.storageSpace,
}));
vi.mock("@electron/vault/manage", () => ({
  vaults: {},
  createVault: mocks.create,
  connectVault: mocks.connect,
  unlockVault: mocks.unlock,
}));
vi.mock("@electron/vault/validate", () => ({
  validateVaultConfig: mocks.validate,
}));

import "@electron/vault/connection-ipc";
import { DEFAULT_VAULT_OPTIONS } from "@diskpond/constants/vault";

const payload = {
  id: "vlt_new",
  provider: "WEBDAV",
  name: "Fixture",
  config: { url: "https://example.test", password: "provider-secret" },
  password: "vault-secret",
};
function invoke(name: string, event: unknown, ...args: unknown[]) {
  const handler = mocks.handlers.get(`vault.${name}`);
  if (!handler) throw new Error("Missing handler");
  return handler(event, ...args);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.saved.mockReturnValue(false);
});
it.each([
  "S3_COMPATIBLE",
  "DISKPOND_CLOUD",
])("accepts %s with omitted fields and explicit empty/false values", async (provider) => {
  const config = {
    endpoint: "s3.example.test",
    bucket: "bucket",
    accessKeyId: "key",
    accessKeySecret: undefined,
    sessionToken: "",
    region: "",
    prefix: "",
    disableTls: false,
    disableTlsVerification: false,
  };
  await invoke("connect", mocks.event, {
    ...payload,
    provider,
    config,
  });
  expect(mocks.connect).toHaveBeenCalledWith(
    expect.objectContaining({ provider, config }),
  );
});
it.each([
  "validate",
  "create",
  "connect",
])("validates DiskPond Cloud at the %s boundary", async (method) => {
  const config = {
    endpoint: "https://storage.example.test/",
    bucket: "bucket",
    accessKeyId: "key",
    accessKeySecret: "secret",
    region: "eu-west-1",
    disableTls: false,
    disableTlsVerification: false,
  };
  const request = (endpoint: string) => {
    const vault = {
      ...payload,
      id: "vlt_cloud_fixture",
      provider: "DISKPOND_CLOUD",
      config: { ...config, endpoint },
    };
    return method === "validate"
      ? { type: vault.provider, config: vault.config, intent: "CONNECT" }
      : method === "create"
        ? {
            vault: { ...vault, options: DEFAULT_VAULT_OPTIONS },
            userPolicy: {},
            globalPolicy: {},
          }
        : vault;
  };
  expect(() =>
    invoke(
      method,
      mocks.event,
      request("https://user:secret@storage.example.test"),
    ),
  ).toThrow("Invalid connection request");
  expect(mocks.validate).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.connect).not.toHaveBeenCalled();
  await invoke(method, mocks.event, request(config.endpoint));
  expect(
    method === "validate"
      ? mocks.validate
      : method === "create"
        ? mocks.create
        : mocks.connect,
  ).toHaveBeenCalledOnce();
});
it("accepts only active local vaults for unlock and the sanitized summary", async () => {
  await invoke("unlock", mocks.event, {
    vaultId: "vlt_local",
    password: "exact",
  });
  invoke("connectionSummary", mocks.event, { vaultId: "vlt_local" });
  expect(mocks.unlock).toHaveBeenCalledOnce();
  expect(mocks.summary).toHaveBeenCalledOnce();
  expect(() =>
    invoke("unlock", mocks.event, {
      vaultId: "vlt_unknown",
      password: "exact",
    }),
  ).toThrow("Local vault not found");
});
it.each([
  "vlt_local",
  "temporary",
])("rejects new connections colliding with %s", async (id) => {
  await expect(
    invoke("connect", mocks.event, { ...payload, id }),
  ).rejects.toThrow("already exists");
  expect(mocks.connect).not.toHaveBeenCalled();
});
it("rejects existing saved files and overlapping new connection requests", async () => {
  mocks.saved.mockReturnValue(true);
  await expect(invoke("connect", mocks.event, payload)).rejects.toThrow(
    "already exists",
  );
  mocks.saved.mockReturnValue(false);
  let finish: (value: object) => void = () => {};
  mocks.connect.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const pending = invoke("connect", mocks.event, payload);
  await expect(invoke("connect", mocks.event, payload)).rejects.toThrow("busy");
  await expect(
    invoke("connect", mocks.event, { ...payload, id: "vlt_other" }),
  ).rejects.toThrow("busy");
  finish({});
  await pending;
});
it.each([
  { ...payload, id: "../outside" },
  { ...payload, config: { url: "invalid", password: "never-log-this" } },
  { ...payload, provider: "CLOUDBLINK" },
  { ...payload, extra: "never-log-this" },
])("rejects malformed payloads without returning their credentials", (value) => {
  expect(() => invoke("connect", mocks.event, value)).toThrow(
    "Invalid connection request",
  );
  expect(mocks.connect).not.toHaveBeenCalled();
});
it("rejects extra arguments and foreign frames", () => {
  expect(() => invoke("connect", mocks.event, payload, {})).toThrow(
    "Invalid connection request",
  );
  expect(() =>
    invoke("connect", { ...mocks.event, senderFrame: {} }, payload),
  ).toThrow("Invalid desktop request");
  expect(mocks.connect).not.toHaveBeenCalled();
});
it("scopes storage-space reads to an active vault and the main desktop frame", async () => {
  mocks.storageSpace.mockResolvedValue({
    status: "AVAILABLE",
    availableBytes: 1234,
  });
  expect(
    await invoke("storageSpace", mocks.event, { vaultId: "vlt_local" }),
  ).toEqual({ status: "AVAILABLE", availableBytes: 1234 });
  expect(mocks.storageSpace).toHaveBeenCalledWith({ vaultId: "vlt_local" });
  expect(() =>
    invoke("storageSpace", mocks.event, { vaultId: "vlt_unknown" }),
  ).toThrow("Local vault not found");
  for (const args of [
    [],
    [{ vaultId: "../outside" }],
    [{ vaultId: "vlt_local", path: "C:\\arbitrary" }],
    [{ vaultId: "vlt_local" }, {}],
  ])
    expect(() => invoke("storageSpace", mocks.event, ...args)).toThrow(
      "Invalid connection request",
    );
  for (const event of [
    { ...mocks.event, sender: {} },
    { ...mocks.event, senderFrame: {} },
  ])
    expect(() =>
      invoke("storageSpace", event, { vaultId: "vlt_local" }),
    ).toThrow("Invalid desktop request");
  expect(mocks.storageSpace).toHaveBeenCalledOnce();
});
it("rejects creation IDs shorter than the repository salt minimum before storage writes", () => {
  expect(() =>
    invoke("create", mocks.event, {
      vault: { ...payload, id: "short", options: DEFAULT_VAULT_OPTIONS },
      userPolicy: {},
      globalPolicy: {},
    }),
  ).toThrow("Invalid connection request");
  expect(mocks.create).not.toHaveBeenCalled();
});
