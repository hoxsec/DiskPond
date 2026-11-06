import {
  summarizeAccountStats,
  ZRepositoryStats,
} from "@desktop/lib/account-stats";

const stats = {
  protectedBytes: 1000,
  protectedFiles: 20,
  snapshots: 3,
  logicalBytes: 3000,
  packedBytes: 900,
  savedBytes: 2100,
};

it("adds independent vaults and excludes stale data after failed refreshes", () => {
  expect(
    summarizeAccountStats([
      { data: stats, isError: false },
      { data: { ...stats, protectedBytes: 2000 }, isError: false },
      { data: stats, isError: true },
      { data: null, isError: false },
    ]),
  ).toEqual({
    protectedBytes: 3000,
    protectedFiles: 40,
    snapshots: 6,
    savedBytes: 4200,
    available: 2,
    savingsAvailable: 2,
    total: 4,
  });
});

it("distinguishes unavailable savings from a measured zero", () => {
  const result = summarizeAccountStats([
    { data: { ...stats, savedBytes: null, packedBytes: null }, isError: false },
    { data: { ...stats, savedBytes: 0 }, isError: false },
  ]);
  expect(result.available).toBe(2);
  expect(result.savingsAvailable).toBe(1);
  expect(result.savedBytes).toBe(0);
  expect(summarizeAccountStats([]).total).toBe(0);
});

it("rejects invalid engine counters rather than displaying misleading totals", () => {
  for (const value of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(
      ZRepositoryStats.safeParse({ ...stats, savedBytes: value }).success,
    ).toBe(false);
  }
  expect(ZRepositoryStats.safeParse({}).success).toBe(false);
});
