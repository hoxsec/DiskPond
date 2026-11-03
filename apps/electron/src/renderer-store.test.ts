const mocks = vi.hoisted(() => ({
  values: new Map<string, unknown>([
    ["workspaceReady", true],
    ["preferences.theme", "dark"],
    ["passwords.vlt_local", { type: "PLAIN", data: "secret" }],
    ["accounts.hosted", { secret: "hosted-secret" }],
  ]),
  set: vi.fn(),
}));
vi.mock("@electron/store", () => ({
  store: { get: (key: string) => mocks.values.get(key), set: mocks.set },
}));

import {
  readRendererStore,
  writeRendererStore,
} from "@electron/renderer-store";

it("exposes only presentation preferences in snapshots and key reads", () => {
  expect(readRendererStore("preferences.theme")).toBe("dark");
  expect(readRendererStore("workspaceReady")).toBe(true);
  expect(JSON.stringify(readRendererStore())).not.toContain("secret");
  for (const key of [
    "passwords",
    "passwords.vlt_local",
    "accounts.hosted",
    "__proto__",
    "constructor",
    "migrations",
  ])
    expect(readRendererStore(key)).toBeUndefined();
});

it("rejects writes that bypass password protection or overwrite hosted records", () => {
  for (const key of [
    "passwords.vlt_local",
    "passwords",
    "accounts",
    "preferences",
    "workspaceReady",
    "__proto__",
    null,
  ])
    expect(() =>
      writeRendererStore(key, { type: "PLAIN", data: "secret" }),
    ).toThrow("Invalid preference request");
  expect(mocks.set).not.toHaveBeenCalled();
});

it("validates the retained theme/language/mode/update/local-vault preferences", () => {
  writeRendererStore("preferences.theme", "light");
  expect(mocks.set).toHaveBeenCalledWith("preferences.theme", "light");
  expect(() => writeRendererStore("preferences.theme", "secret")).toThrow(
    "Invalid preference value",
  );
});
