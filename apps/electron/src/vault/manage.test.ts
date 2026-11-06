const mocks = vi.hoisted(() => ({
  collections: {} as Record<
    string,
    { vault: { find: ReturnType<typeof vi.fn> } }
  >,
  fetchVault: vi.fn(
    async (_vault: unknown, _options: unknown): Promise<unknown> => undefined,
  ),
  getHostName: vi.fn((id: string) => `host-${id}`),
  getUserName: vi.fn((id: string) => `user-${id}`),
  killValidationVault: vi.fn(() => undefined),
  preparePasswordCache: vi.fn(),
  validate: vi.fn(async (_input: { intent?: string }) => ({
    code: undefined as string | undefined,
    uniqueID: undefined as string | undefined,
  })),
  logError: vi.fn((_message: unknown, _error?: unknown) => undefined),
  logWarn: vi.fn((_message: unknown) => undefined),
  mapConfigFields: vi.fn((_provider: string, _config: unknown) => ({
    mapped: true,
  })),
  mapProviderType: vi.fn((provider: string) => `mapped-${provider}`),
  startVaultServer: vi.fn(async (id: string) => ({
    address: `https://127.0.0.1/${id}`,
    password: `password-${id}`,
    controlPassword: `control-${id}`,
    process: {
      kill: vi.fn(),
    },
  })),
}));

vi.mock("@electron/db", () => ({
  collections: mocks.collections,
}));
vi.mock("@electron/password", () => ({
  preparePasswordCache: mocks.preparePasswordCache,
  setPasswordCache: vi.fn(),
}));
vi.mock("@electron/vault/connection", () => ({
  connectionFromProvider: (provider: string, config: unknown) => ({
    type: mocks.mapProviderType(provider),
    config: mocks.mapConfigFields(provider, config),
  }),
  rememberConnectionSecrets: vi.fn(),
  saveConnection: vi.fn(),
  completeConnectionMigration: vi.fn(),
  prepareConnection: vi.fn(),
  redactConnectionError: (_id: string, value: string) => value,
}));
vi.mock("@electron/vault/reconnect", () => ({
  connectRepository: (vault: unknown, data: unknown, create: boolean) =>
    mocks.fetchVault(vault, {
      method: "POST",
      path: `/api/v1/repo/${create ? "create" : "connect"}`,
      data,
    }),
}));

vi.mock("@electron/log", () => ({
  log: {
    error: (message: unknown, error?: unknown) =>
      mocks.logError(message, error),
    warn: (message: unknown) => mocks.logWarn(message),
  },
}));

vi.mock("@electron/profile", () => ({
  getHostName: (id: string) => mocks.getHostName(id),
  getUserName: (id: string) => mocks.getUserName(id),
}));

vi.mock("@electron/vault/fetch", () => ({
  fetchVault: (vault: unknown, options: unknown) =>
    mocks.fetchVault(vault, options),
}));

vi.mock("@electron/vault/mapping", () => ({
  mapConfigFields: (provider: string, config: unknown) =>
    mocks.mapConfigFields(provider, config),
  mapProviderType: (provider: string) => mocks.mapProviderType(provider),
}));

vi.mock("@electron/vault/server", () => ({
  startVaultServer: (id: string) => mocks.startVaultServer(id),
}));

vi.mock("@electron/vault/validate", () => ({
  validateVaultConfig: mocks.validate,
  validationVault: {
    server: {
      process: {
        kill: () => mocks.killValidationVault(),
      },
    },
  },
}));

import { DEFAULT_VAULT_OPTIONS } from "@diskpond/constants/vault";
import {
  connectVault,
  createVault,
  getVaultStatus,
  initVaults,
  retryVault,
  stopAllVaults,
  vaultServerStopped,
  vaults,
} from "@electron/vault/manage";

function vaultCollection(ids: string[]) {
  return {
    vault: {
      find: vi.fn(() => ({
        fetch: vi.fn(() =>
          ids.map((id) => ({
            id,
            status: "ACTIVE",
          })),
        ),
      })),
    },
  };
}

describe("vault management", () => {
  beforeEach(() => {
    stopAllVaults();
    vi.clearAllMocks();
    for (const key of Object.keys(mocks.collections))
      delete mocks.collections[key];
    mocks.fetchVault.mockResolvedValue({ success: true });
    mocks.validate.mockImplementation(async ({ intent }) =>
      intent === "CREATE"
        ? { code: "NOT_INITIALIZED", uniqueID: undefined }
        : { code: undefined, uniqueID: btoa("fixture-identity") },
    );
  });

  it("creates a vault server and sends the repo create payload", async () => {
    const result = await createVault({
      vault: {
        id: "vlt_1",
        name: "Backups",
        provider: "INTERNAL_DRIVE",
        config: {},
        options: {
          version: 2,
          encryption: "AES256-GCM-HMAC-SHA256",
          hash: "BLAKE3-256",
          splitter: "DYNAMIC-4M-BUZHASH",
          errorCorrectionAlgorithm: "REED-SOLOMON-CRC32",
          errorCorrectionOverhead: 10,
        },
        password: "secret",
      },
      userPolicy: { schedule: "user" },
      globalPolicy: { retention: "global" },
    });

    expect(result).toEqual({ success: true, coreId: "vlt_1" });
    expect(mocks.startVaultServer).toHaveBeenCalledWith("vlt_1");
    expect(mocks.fetchVault).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vlt_1" }),
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/repo/create",
        data: expect.objectContaining({
          globalPolicy: { retention: "global" },
          userPolicy: { schedule: "user" },
          clientOptions: {
            description: "Backups",
            username: "user-vlt_1",
            hostname: "host-vlt_1",
          },
          storage: {
            type: "mapped-INTERNAL_DRIVE",
            config: {
              mapped: true,
            },
          },
          password: "secret",
        }),
      }),
    );
    expect(vaults.vlt_1).toMatchObject({ id: "vlt_1", status: "STARTING" });
  });

  it.each([
    "REPOSITORY_EXISTS",
    "INVALID_REPOSITORY",
    "DESTINATION_NOT_EMPTY",
    "STORAGE_UNREACHABLE",
  ])("refuses creation before starting a writable engine: %s", async (code) => {
    mocks.validate.mockResolvedValueOnce({ code, uniqueID: undefined });
    const result = await createVault({
      vault: {
        id: "vlt_new",
        name: "Fixture",
        provider: "INTERNAL_DRIVE",
        config: {},
        password: "new-password",
        options: DEFAULT_VAULT_OPTIONS,
      },
      userPolicy: {},
      globalPolicy: {},
    });
    expect(result.code).toBe(code);
    expect(mocks.startVaultServer).not.toHaveBeenCalled();
    expect(mocks.fetchVault).not.toHaveBeenCalled();
  });

  it.each([
    "NOT_INITIALIZED",
    "INVALID_PASSWORD",
    "INVALID_REPOSITORY",
    "STORAGE_MISSING",
  ])("never falls back to creation when connecting fails: %s", async (code) => {
    mocks.validate.mockResolvedValueOnce({ code, uniqueID: undefined });
    expect(
      (
        await connectVault({
          id: "vlt_new",
          name: "Fixture",
          provider: "INTERNAL_DRIVE",
          config: {},
          password: " exact ",
        })
      ).code,
    ).toBe(code);
    expect(mocks.startVaultServer).not.toHaveBeenCalled();
    expect(mocks.fetchVault).not.toHaveBeenCalled();
  });

  it("rejects duplicate identities during an overlapping connect and permits retry after failure", async () => {
    const payload = {
      id: "vlt_first",
      name: "Fixture",
      provider: "INTERNAL_DRIVE" as const,
      config: {},
      password: " exact ",
    };
    let finish!: (value: unknown) => void;
    mocks.fetchVault.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = connectVault(payload);
    await vi.waitFor(() => expect(mocks.fetchVault).toHaveBeenCalledOnce());
    expect((await connectVault({ ...payload, id: "vlt_second" })).code).toBe(
      "DUPLICATE_VAULT",
    );
    finish({ code: "CONNECTION_FAILED" });
    await first;
    expect(await connectVault({ ...payload, id: "vlt_second" })).toMatchObject({
      coreId: "fixture-identity",
    });
    expect(mocks.validate).toHaveBeenCalledWith(
      expect.objectContaining({ password: " exact " }),
    );
  });

  it("rejects the identity of a persisted vault even when its engine is stopped", async () => {
    mocks.collections.local = {
      vault: {
        find: vi.fn(() => ({
          fetch: () => [
            { id: "vlt_saved", coreId: "fixture-identity", status: "ACTIVE" },
          ],
        })),
      },
    };
    expect(
      (
        await connectVault({
          id: "vlt_new",
          name: "Fixture",
          provider: "INTERNAL_DRIVE",
          config: {},
          password: "exact",
        })
      ).code,
    ).toBe("DUPLICATE_VAULT");
    expect(mocks.startVaultServer).not.toHaveBeenCalled();
  });

  it("stops a newly started vault when repo creation fails", async () => {
    mocks.fetchVault.mockRejectedValueOnce({ code: "CREATE_FAILED" });

    const promise = createVault({
      vault: {
        id: "vlt_1",
        name: "Backups",
        provider: "INTERNAL_DRIVE",
        config: {},
        options: {
          version: 2,
          encryption: "AES256-GCM-HMAC-SHA256",
          hash: "BLAKE3-256",
          splitter: "DYNAMIC-4M-BUZHASH",
          errorCorrectionAlgorithm: "REED-SOLOMON-CRC32",
          errorCorrectionOverhead: 10,
        },
        password: "secret",
      },
      userPolicy: {},
      globalPolicy: {},
    });

    await expect(promise).rejects.toMatchObject({
      message: "CREATE_FAILED",
    });

    const startedServer = await mocks.startVaultServer.mock.results[0]?.value;
    expect(startedServer.process.kill).toHaveBeenCalled();
    expect(vaults.vlt_1).toBeUndefined();
  });

  it("releases a live identity after an exit before its descriptor was persisted", async () => {
    const payload = {
      id: "vlt_first",
      name: "Fixture",
      provider: "INTERNAL_DRIVE" as const,
      config: {},
      password: "exact",
    };
    await connectVault(payload);
    const first = vaults.vlt_first;
    if (!first) throw new Error("Vault did not connect");
    vaultServerStopped(first.id, first.server.process);
    expect(await connectVault({ ...payload, id: "vlt_retry" })).toMatchObject({
      coreId: "fixture-identity",
    });
  });

  it("connects through an existing vault server without starting another one", async () => {
    const kill = vi.fn();
    vaults.vlt_1 = {
      id: "vlt_1",
      status: "RUNNING",
      server: {
        process: { kill },
      },
    } as never;

    await expect(
      connectVault({
        id: "vlt_1",
        name: "Backups",
        provider: "INTERNAL_DRIVE",
        config: {},
        password: "secret",
        version: 2,
      }),
    ).resolves.toEqual({ success: true, coreId: "fixture-identity" });

    expect(mocks.startVaultServer).not.toHaveBeenCalled();
    expect(mocks.fetchVault).toHaveBeenCalledWith(
      vaults.vlt_1,
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/repo/connect",
        data: expect.objectContaining({
          storage: {
            type: "mapped-INTERNAL_DRIVE",
            config: {
              mapped: true,
            },
          },
          password: "secret",
        }),
      }),
    );
  });

  it("starts only local vaults, ignores cached hosted accounts and shuts down stale vaults", async () => {
    const staleKill = vi.fn();
    vaults.stale = {
      id: "stale",
      status: "RUNNING",
      server: { process: { kill: staleKill } },
    } as never;
    mocks.collections.local = vaultCollection(["local_active"]);
    mocks.collections.acct_1 = vaultCollection(["remote_active"]);
    mocks.collections.acct_missing = vaultCollection(["missing_active"]);

    await initVaults();

    expect(mocks.startVaultServer).toHaveBeenCalledWith("local_active");
    expect(mocks.startVaultServer).not.toHaveBeenCalledWith("remote_active");
    expect(mocks.startVaultServer).not.toHaveBeenCalledWith("missing_active");
    expect(mocks.preparePasswordCache.mock.calls).toEqual([["local_active"]]);
    expect(staleKill).toHaveBeenCalled();
    expect(vaults.stale).toBeUndefined();
    expect(vaults.local_active).toMatchObject({ status: "STARTING" });
    expect(vaults.remote_active).toBeUndefined();
  });

  it("makes unexpected exits retryable and ignores a replaced engine's late exit", async () => {
    mocks.collections.local = vaultCollection(["local_active"]);
    await initVaults();
    const initial = vaults.local_active;
    if (!initial) throw new Error("Vault did not start");
    const old = initial.server.process;
    vaultServerStopped("local_active", old);
    expect(getVaultStatus("local_active")?.status).toBe("FAILED");
    await retryVault("local_active");
    const restarted = vaults.local_active;
    if (!restarted) throw new Error("Vault did not restart");
    const replacement = restarted.server;
    expect(replacement.process).not.toBe(old);
    vaultServerStopped("local_active", old);
    expect(vaults.local_active?.server).toBe(replacement);
  });

  it("tracks a newly connected server so password re-entry does not leak an unmanaged engine", async () => {
    const payload = {
      id: "vlt_reentry",
      name: "Fixture",
      provider: "INTERNAL_DRIVE" as const,
      config: {},
      password: "secret",
    };
    await connectVault(payload);
    const server = await mocks.startVaultServer.mock.results[0]?.value;
    expect(vaults.vlt_reentry?.server).toBe(server);
    await connectVault(payload);
    expect(mocks.startVaultServer).toHaveBeenCalledOnce();
    stopAllVaults();
    expect(server.process.kill).toHaveBeenCalledOnce();
  });

  it("stops a newly spawned server when password re-entry is rejected", async () => {
    mocks.fetchVault.mockResolvedValueOnce({
      code: "INVALID_PASSWORD",
      error: "invalid password",
    });
    const result = await connectVault({
      id: "vlt_reentry",
      name: "Fixture",
      provider: "INTERNAL_DRIVE",
      config: {},
      password: "wrong",
    });
    expect(result.code).toBe("INVALID_PASSWORD");
    const server = await mocks.startVaultServer.mock.results[0]?.value;
    expect(server.process.kill).toHaveBeenCalledOnce();
    expect(vaults.vlt_reentry).toBeUndefined();
  });

  it("reports status for running vaults and null for missing vaults", () => {
    vaults.vlt_1 = {
      id: "vlt_1",
      status: "RUNNING",
      initTask: { id: "task_1" },
      server: { process: { kill: vi.fn() } },
    } as never;

    expect(getVaultStatus("vlt_1")).toEqual({
      status: "RUNNING",
      initTask: { id: "task_1" },
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(getVaultStatus("missing")).toBeNull();
    consoleError.mockRestore();
  });

  it("exposes a failed vault startup, continues other vaults, and retries on request", async () => {
    const error = new Error("Backup engine failed to start");
    const staleKill = vi.fn();
    vaults.stale = {
      id: "stale",
      status: "RUNNING",
      server: { process: { kill: staleKill } },
    } as never;
    mocks.collections.local = vaultCollection(["failed", "healthy"]);
    mocks.startVaultServer.mockRejectedValueOnce(error);

    await expect(initVaults()).resolves.toBeUndefined();

    expect(mocks.logError).toHaveBeenCalledWith(
      "Failed to start vault failed",
      error,
    );
    expect(vaults.failed).toBeUndefined();
    expect(getVaultStatus("failed")).toEqual({
      status: "FAILED",
      initTask: undefined,
    });
    expect(vaults.healthy).toMatchObject({ id: "healthy", status: "STARTING" });
    expect(staleKill).toHaveBeenCalledOnce();
    expect(vaults.stale).toBeUndefined();

    await expect(retryVault("failed")).resolves.toBeUndefined();

    expect(vaults.failed).toMatchObject({ id: "failed", status: "STARTING" });
    expect(getVaultStatus("failed")?.status).toBe("STARTING");
    expect(mocks.startVaultServer.mock.calls).toEqual([
      ["failed"],
      ["healthy"],
      ["failed"],
    ]);
    expect(mocks.logError).toHaveBeenCalledOnce();
  });

  it("shows retry progress and keeps another failed attempt recoverable", async () => {
    mocks.collections.local = vaultCollection(["failed"]);
    mocks.startVaultServer.mockRejectedValueOnce(
      new Error("Engine unavailable"),
    );
    await initVaults();

    let rejectStartup!: (error: Error) => void;
    const startup = new Promise<
      Awaited<ReturnType<typeof mocks.startVaultServer>>
    >((_, reject) => {
      rejectStartup = reject;
    });
    mocks.startVaultServer.mockReturnValueOnce(startup);

    const retry = retryVault("failed");
    await Promise.resolve();
    expect(getVaultStatus("failed")?.status).toBe("STARTING");

    rejectStartup(new Error("Engine still unavailable"));
    await retry;
    expect(getVaultStatus("failed")?.status).toBe("FAILED");

    await retryVault("failed");
    expect(vaults.failed).toMatchObject({ id: "failed", status: "STARTING" });
    expect(mocks.startVaultServer).toHaveBeenCalledTimes(3);
  });

  it("retries only the requested failed vault", async () => {
    mocks.collections.local = vaultCollection(["first", "second"]);
    mocks.startVaultServer
      .mockRejectedValueOnce(new Error("Engine unavailable"))
      .mockRejectedValueOnce(new Error("Engine unavailable"));
    await initVaults();

    await retryVault("first");

    expect(getVaultStatus("first")?.status).toBe("STARTING");
    expect(getVaultStatus("second")?.status).toBe("FAILED");
    expect(mocks.startVaultServer.mock.calls).toEqual([
      ["first"],
      ["second"],
      ["first"],
    ]);
  });

  it("clears failure states for removed vaults and during shutdown", async () => {
    const ids = ["removed", "remaining"];
    mocks.collections.local = vaultCollection(ids);
    mocks.startVaultServer
      .mockRejectedValueOnce(new Error("Engine unavailable"))
      .mockRejectedValueOnce(new Error("Engine unavailable"));
    await initVaults();
    expect(getVaultStatus("removed")?.status).toBe("FAILED");
    expect(getVaultStatus("remaining")?.status).toBe("FAILED");

    ids.shift();
    mocks.startVaultServer.mockRejectedValueOnce(
      new Error("Engine unavailable"),
    );
    await initVaults();

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(getVaultStatus("removed")).toBeNull();
    expect(getVaultStatus("remaining")?.status).toBe("FAILED");
    stopAllVaults();
    expect(getVaultStatus("remaining")).toBeNull();
    consoleError.mockRestore();
  });

  it("logs unexpected reconciliation errors and keeps the startup queue usable", async () => {
    const error = new Error("Collection lookup failed");
    mocks.collections.local = vaultCollection(["healthy"]);
    mocks.collections.local.vault.find.mockImplementationOnce(() => {
      throw error;
    });

    await expect(initVaults()).resolves.toBeUndefined();
    expect(mocks.logError).toHaveBeenCalledWith(
      "Failed to initialize vaults",
      error,
    );

    await expect(initVaults()).resolves.toBeUndefined();
    expect(vaults.healthy).toMatchObject({ id: "healthy", status: "STARTING" });
  });

  it("starts each vault once when sync requests initialization during startup", async () => {
    const ids = ["first"];
    mocks.collections.local = vaultCollection(ids);
    const server = {
      address: "https://127.0.0.1/first",
      password: "password-first",
      controlPassword: "control-first",
      process: { kill: vi.fn() },
    };
    let resolveStartup!: (value: typeof server) => void;
    const startup = new Promise<typeof server>((resolve) => {
      resolveStartup = resolve;
    });
    mocks.startVaultServer.mockReturnValueOnce(startup);

    const firstInit = initVaults();
    await Promise.resolve();
    ids.push("second");
    const secondInit = initVaults();

    resolveStartup(server);
    await Promise.all([firstInit, secondInit]);

    expect(mocks.startVaultServer.mock.calls).toEqual([["first"], ["second"]]);
    expect(Object.keys(vaults).sort()).toEqual(["first", "second"]);
    expect(server.process.kill).not.toHaveBeenCalled();
  });

  it("stops all running vaults and the validation vault", () => {
    const killA = vi.fn();
    const killB = vi.fn();
    vaults.a = {
      id: "a",
      status: "RUNNING",
      server: { process: { kill: killA } },
    } as never;
    vaults.b = {
      id: "b",
      status: "RUNNING",
      server: { process: { kill: killB } },
    } as never;

    stopAllVaults();

    expect(killA).toHaveBeenCalled();
    expect(killB).toHaveBeenCalled();
    expect(mocks.killValidationVault).toHaveBeenCalled();
    expect(vaults).toEqual({});
  });
});
