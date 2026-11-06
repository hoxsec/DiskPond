const mocks = vi.hoisted(() => ({
  values: new Map<string, unknown>([
    ["workspaceReady", true],
    ["preferences.theme", "dark"],
    ["passwords.vlt_local", { type: "PLAIN", data: "secret" }],
    ["accounts.hosted", { secret: "hosted-secret" }],
  ]),
  set: vi.fn(),
  setLaunchAtLogin: vi.fn(),
}));
vi.mock("@electron/store", () => ({
  store: { get: (key: string) => mocks.values.get(key), set: mocks.set },
}));
vi.mock("@electron/startup", () => ({
  setLaunchAtLogin: mocks.setLaunchAtLogin,
}));

import {
  readRendererStore,
  writeRendererStore,
} from "@electron/renderer-store";

it("exposes only allowed preferences in snapshots and key reads", () => {
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
  for (const language of ["en", "es", "fr", "de", "tr", "nl", "it", "pl"]) {
    writeRendererStore("preferences.language", language);
    expect(mocks.set).toHaveBeenCalledWith("preferences.language", language);
  }
  for (const language of ["unknown", "es-MX", "", null, {}])
    expect(() => writeRendererStore("preferences.language", language)).toThrow(
      "Invalid preference value",
    );
  writeRendererStore("preferences.theme", "light");
  expect(mocks.set).toHaveBeenCalledWith("preferences.theme", "light");
  writeRendererStore("preferences.checkForUpdates", false);
  expect(mocks.set).toHaveBeenCalledWith("preferences.checkForUpdates", false);
  expect(() =>
    writeRendererStore("preferences.checkForUpdates", "false"),
  ).toThrow("Invalid preference value");
  expect(() => writeRendererStore("preferences.theme", "secret")).toThrow(
    "Invalid preference value",
  );
});

it("persists only supported vault colors through the preference bridge", () => {
  const colors = { "vault-a": "rose", "vault-b": "blue" };
  writeRendererStore("preferences.vaultColors", colors);
  expect(mocks.set).toHaveBeenCalledWith("preferences.vaultColors", colors);
  mocks.values.set("preferences.vaultColors", colors);
  expect(readRendererStore("preferences.vaultColors")).toEqual(colors);
  expect(() =>
    writeRendererStore("preferences.vaultColors", {
      "vault-a": "url(file://private)",
    }),
  ).toThrow("Invalid preference value");
});

it("validates desktop controls before allowing startup or preference changes", async () => {
  for (const key of [
    "preferences.launchAtLogin",
    "preferences.keepRunningInBackground",
    "preferences.reduceMotion",
  ]) {
    expect(() => writeRendererStore(key, "false")).toThrow(
      "Invalid preference value",
    );
  }
  for (const scale of [0, 100, "0", "100", "NaN", null])
    expect(() =>
      writeRendererStore("preferences.interfaceScale", scale),
    ).toThrow("Invalid preference value");
  expect(mocks.setLaunchAtLogin).not.toHaveBeenCalled();

  mocks.setLaunchAtLogin.mockRejectedValueOnce(new Error("OS failure"));
  await expect(
    writeRendererStore("preferences.launchAtLogin", false),
  ).rejects.toThrow("OS failure");
  expect(mocks.set).not.toHaveBeenCalledWith(
    "preferences.launchAtLogin",
    false,
  );
});
