const mocks = vi.hoisted(() => {
  const frame = { url: "diskpondapp://frontend/local" };
  const contents = { mainFrame: frame };
  return {
    handlers: new Map<
      string,
      (event: unknown, ...args: unknown[]) => unknown
    >(),
    frame,
    contents,
    event: { sender: contents, senderFrame: frame },
    findOne: vi.fn((query: { id: string }) =>
      query.id === "vlt_local" ? { id: query.id } : undefined,
    ),
    get: vi.fn(),
    set: vi.fn(),
    status: vi.fn(),
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
vi.mock("@electron/password", () => ({
  getPasswordCache: mocks.get,
  setPasswordCache: mocks.set,
  getPasswordStorageStatus: mocks.status,
}));

import "@electron/password-ipc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.frame.url = "diskpondapp://frontend/local";
});

function invoke(name: string, event: unknown, ...args: unknown[]) {
  const handler = mocks.handlers.get(`vault.password.${name}`);
  if (!handler) throw new Error("Missing handler");
  return handler(event, ...args);
}

it("allows validated local password operations and a secret-free status request", () => {
  invoke("set", mocks.event, { vaultId: "vlt_local", password: "secret" });
  invoke("get", mocks.event, { vaultId: "vlt_local" });
  invoke("status", mocks.event);
  expect(mocks.set).toHaveBeenCalledWith({
    vaultId: "vlt_local",
    password: "secret",
  });
  expect(mocks.get).toHaveBeenCalledWith({ vaultId: "vlt_local" });
  expect(mocks.status).toHaveBeenCalledOnce();
});

it.each([
  { sender: {}, senderFrame: mocks.frame },
  { sender: mocks.contents, senderFrame: { url: "diskpondapp://frontend" } },
  { sender: mocks.contents, senderFrame: null },
])("rejects other windows and subframes", (event) => {
  expect(() => invoke("get", event, { vaultId: "vlt_local" })).toThrow(
    "Invalid desktop request",
  );
  expect(mocks.get).not.toHaveBeenCalled();
});

it("rejects an external page in the main frame", () => {
  mocks.frame.url = "https://example.com/";
  expect(() => invoke("status", mocks.event)).toThrow(
    "Invalid desktop request",
  );
});

it.each([
  { vaultId: "../elsewhere", password: "secret" },
  { vaultId: "vlt_local", password: "secret", extra: true },
  { vaultId: "vlt_local", password: 123 },
  { vaultId: "vlt_local", password: "" },
  null,
])("rejects malformed inputs before cache access", (payload) => {
  expect(() => invoke("set", mocks.event, payload)).toThrow(
    "Invalid password request",
  );
  expect(mocks.set).not.toHaveBeenCalled();
});

it("rejects dormant hosted IDs, unknown vaults and extra arguments", () => {
  expect(() => invoke("get", mocks.event, { vaultId: "vlt_hosted" })).toThrow(
    "Local vault not found",
  );
  expect(() =>
    invoke("get", mocks.event, { vaultId: "vlt_local" }, "extra"),
  ).toThrow("Invalid password request");
  expect(() => invoke("status", mocks.event, {})).toThrow(
    "Invalid password status request",
  );
  expect(mocks.get).not.toHaveBeenCalled();
});
