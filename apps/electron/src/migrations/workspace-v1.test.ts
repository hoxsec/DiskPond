const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  exists: vi.fn(() => false),
}));
vi.mock("node:fs", () => ({ existsSync: mocks.exists }));
vi.mock("@electron/path", () => ({
  globalAccountDirectory: () => "/accounts",
}));
vi.mock("@electron/store", () => ({
  store: {
    get: (key: string) => mocks.values[key],
    set: (values: Record<string, unknown>) =>
      Object.assign(mocks.values, values),
  },
}));

import { migrateWorkspaceV1 } from "@electron/migrations/workspace-v1";
import { openWorkspace } from "@electron/workspace";

describe("account-free workspace migration", () => {
  beforeEach(() => {
    mocks.values = {};
    mocks.exists.mockReturnValue(false);
  });

  it("shows onboarding on a fresh installation and persists the explicit open action", async () => {
    await migrateWorkspaceV1();
    expect(mocks.values).toEqual({
      currentAccountId: "local",
      workspaceReady: false,
    });
    openWorkspace();
    await migrateWorkspaceV1();
    expect(mocks.values).toEqual({
      currentAccountId: "local",
      workspaceReady: true,
    });
  });

  it.each([
    "skip",
    "collection",
  ])("keeps an existing local workspace accessible (%s)", async (fixture) => {
    if (fixture === "skip") mocks.values.hasSkippedAuth = true;
    else mocks.exists.mockReturnValue(true);
    await migrateWorkspaceV1();
    expect(mocks.values.workspaceReady).toBe(true);
  });

  it("selects local while preserving preferences, passwords and dormant account records", async () => {
    const existing = {
      currentAccountId: "acct_old",
      preferences: { theme: "dark" },
      passwords: {
        vlt_fixture: { encryption: "safeStorage", value: "fixture" },
      },
      accounts: {
        local: { lastUsedVaultId: "vlt_fixture" },
        acct_old: { active: true },
      },
    };
    mocks.values = structuredClone(existing);
    mocks.exists.mockReturnValue(true);
    await migrateWorkspaceV1();
    await migrateWorkspaceV1();
    expect(mocks.values).toEqual({
      ...existing,
      currentAccountId: "local",
      workspaceReady: true,
    });
  });
});
