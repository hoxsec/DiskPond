vi.mock("@electron/store", () => ({ store: { get: vi.fn(), set: vi.fn() } }));

import { store } from "@electron/store";
import {
  newUpdateAttempt,
  readUpdateState,
  reconcileUpdateHistory,
  saveUpdateState,
  type UpdateLocalState,
} from "@electron/update-history";

it("round-trips version/outcome/timestamps without retaining error paths", () => {
  const state: UpdateLocalState = {
    history: [newUpdateAttempt("0.1.3", "0.1.2")],
    reminder: null,
  };
  saveUpdateState(state);
  expect(store.set).toHaveBeenCalledWith("updates", state);
  vi.mocked(store.get).mockReturnValue({ ...state, secret: "not exposed" });
  expect(readUpdateState()).toEqual(state);
});
it("recovers interrupted downloads and unconfirmed installations truthfully", () => {
  const state: UpdateLocalState = {
    history: [
      newUpdateAttempt("0.1.3", "0.1.2"),
      { ...newUpdateAttempt("0.1.3", "0.1.2"), outcome: "INSTALLING" },
    ],
    reminder: null,
  };
  expect(
    reconcileUpdateHistory(state, "0.1.2").history.map(
      (entry) => entry.outcome,
    ),
  ).toEqual(["INTERRUPTED", "NOT_INSTALLED"]);
  expect(reconcileUpdateHistory(state, "0.1.4").history[1]?.outcome).toBe(
    "NOT_INSTALLED",
  );
});
it("rejects malformed and unbounded persisted records", () => {
  vi.mocked(store.get).mockReturnValue({ history: [{ version: "garbled" }] });
  expect(readUpdateState()).toEqual({ history: [], reminder: null });
  expect(() =>
    saveUpdateState({
      history: Array.from({ length: 51 }, () =>
        newUpdateAttempt("0.1.3", "0.1.2"),
      ),
      reminder: null,
    }),
  ).toThrow();
});
