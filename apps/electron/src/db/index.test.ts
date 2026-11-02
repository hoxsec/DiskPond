const mocks = vi.hoisted(() => {
  const initialVaults: { id: string }[] = [];
  const ready = vi.fn(async () => undefined);
  class MockCollection {
    items: { id: string }[];
    isReady = ready;
    on = vi.fn();
    find = vi.fn(() => ({ fetch: () => this.items }));
    constructor({ name }: { name: string }) {
      this.items = name === "vault" ? [...initialVaults] : [];
    }
  }
  return {
    initialVaults,
    ready,
    MockCollection,
    addCollection: vi.fn(),
    initVaults: vi.fn(async () => undefined),
  };
});

vi.mock("node:fs", () => ({ existsSync: () => true, mkdirSync: vi.fn() }));
vi.mock("@blinkdisk/signaldb-electron/main", () => ({
  setupSignalDBMain: () => ({ addCollection: mocks.addCollection }),
}));
vi.mock("@electron/db/schema", () => ({
  SchemaCollection: mocks.MockCollection,
}));
vi.mock("@electron/path", () => ({
  globalAccountDirectory: () => "/accounts",
}));
vi.mock("@electron/vault/manage", () => ({ initVaults: mocks.initVaults }));
vi.mock("@signaldb/fs", () => ({ default: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: {} }));

describe("local workspace collections", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.initialVaults.length = 0;
    mocks.ready.mockResolvedValue(undefined);
  });

  it("loads persisted local vaults before engine reconciliation", async () => {
    mocks.initialVaults.push({ id: "existing-local-vault" });
    const db = await import("@electron/db");
    mocks.initVaults.mockImplementationOnce(async () => {
      expect(db.collections.local?.vault.find().fetch()).toEqual([
        { id: "existing-local-vault" },
      ]);
    });
    await db.setupCollections();
    expect(Object.keys(db.collections)).toEqual(["local"]);
    expect(mocks.initVaults).toHaveBeenCalledOnce();
    expect(
      mocks.addCollection.mock.calls.map(([, options]) => options.name),
    ).toEqual(["local/vault", "local/config"]);
  });

  it("rejects hosted-account initialization without registering collections", async () => {
    const db = await import("@electron/db");
    await expect(db.initAccountCollections("acct_cached")).rejects.toThrow(
      "local workspace",
    );
    expect(mocks.addCollection).not.toHaveBeenCalled();
    expect(mocks.initVaults).not.toHaveBeenCalled();
  });

  it("shares overlapping initialization and registers only once", async () => {
    const db = await import("@electron/db");
    await Promise.all([db.setupCollections(), db.setupCollections()]);
    await db.setupCollections();
    expect(mocks.addCollection).toHaveBeenCalledTimes(2);
    expect(mocks.initVaults).toHaveBeenCalledOnce();
  });

  it("surfaces persistence failure and allows a later retry", async () => {
    const db = await import("@electron/db");
    mocks.ready.mockRejectedValueOnce(new Error("Unreadable collection"));
    await expect(db.setupCollections()).rejects.toThrow(
      "Unreadable collection",
    );
    expect(mocks.addCollection).not.toHaveBeenCalled();
    expect(mocks.initVaults).not.toHaveBeenCalled();
    await db.setupCollections();
    expect(mocks.addCollection).toHaveBeenCalledTimes(2);
  });
});
