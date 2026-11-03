import { randomUUID } from "node:crypto";
import { store } from "@electron/store";
import { z } from "zod";

const outcome = z.enum([
  "DOWNLOADING",
  "DOWNLOADED",
  "CANCELED",
  "DOWNLOAD_FAILED",
  "INTERRUPTED",
  "INSTALLING",
  "INSTALLED",
  "INSTALL_FAILED",
  "NOT_INSTALLED",
]);
const entry = z.object({
  id: z.string().uuid(),
  version: z.string().max(100),
  fromVersion: z.string().max(100),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  outcome,
});
const stateSchema = z.object({
  history: z.array(entry).max(50),
  reminder: z
    .object({
      version: z.string().max(100),
      until: z.number().finite().nonnegative(),
    })
    .nullable(),
});
export type UpdateHistoryEntry = z.infer<typeof entry>;
export type UpdateOutcome = z.infer<typeof outcome>;
export type UpdateLocalState = z.infer<typeof stateSchema>;

export function readUpdateState(): UpdateLocalState {
  const parsed = stateSchema.safeParse(store.get("updates"));
  return parsed.success ? parsed.data : { history: [], reminder: null };
}

export function saveUpdateState(state: UpdateLocalState) {
  store.set("updates", stateSchema.parse(state));
}

export function reconcileUpdateHistory(
  state: UpdateLocalState,
  currentVersion: string,
): UpdateLocalState {
  return {
    ...state,
    history: state.history.map((item) => {
      if (item.outcome !== "INSTALLING" && item.outcome !== "DOWNLOADING")
        return item;
      return {
        ...item,
        updatedAt: new Date().toISOString(),
        outcome:
          item.outcome === "DOWNLOADING"
            ? "INTERRUPTED"
            : item.version === currentVersion
              ? "INSTALLED"
              : "NOT_INSTALLED",
      };
    }),
  };
}

export function newUpdateAttempt(
  version: string,
  fromVersion: string,
): UpdateHistoryEntry {
  const date = new Date().toISOString();
  return {
    id: randomUUID(),
    version,
    fromVersion,
    startedAt: date,
    updatedAt: date,
    outcome: "DOWNLOADING",
  };
}
