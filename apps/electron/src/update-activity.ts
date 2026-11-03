import { hasActiveRestores } from "@electron/restore";
import { fetchVault } from "@electron/vault/fetch";
import { hasStartingVaults, vaults } from "@electron/vault/manage";
import { z } from "zod";

export type UpdateActivity = "idle" | "busy" | "unknown";
const sourcesSchema = z.object({
  sources: z.array(
    z.object({
      status: z.string(),
      nextSnapshotTime: z.string().datetime({ offset: true }).nullish(),
    }),
  ),
});
const tasksSchema = z.object({
  tasks: z.array(z.object({ status: z.string() })),
});
const inactiveSources = new Set([
  "IDLE",
  "PAUSED",
  "REMOTE",
  "STOPPED",
  "FAILED",
]);
const terminalTasks = new Set(["SUCCESS", "FAILED", "CANCELED"]);

export async function getUpdateActivity(): Promise<UpdateActivity> {
  if (hasActiveRestores()) return "busy";
  if (hasStartingVaults()) return "unknown";
  const current = Object.values(vaults);
  const states = await Promise.all(
    current.map(async (vault): Promise<UpdateActivity> => {
      if (vault.status === "STARTING") return "unknown";
      try {
        const tasks = tasksSchema.parse(
          await fetchVault(vault, {
            method: "GET",
            path: "/api/v1/tasks",
            timeoutMs: 5000,
          }),
        );
        if (tasks.tasks.some((task) => !terminalTasks.has(task.status)))
          return "busy";
        if (vault.status === "SETUP") return "idle";
        const sources = sourcesSchema.parse(
          await fetchVault(vault, {
            method: "GET",
            path: "/api/v1/sources",
            timeoutMs: 5000,
          }),
        );
        return sources.sources.some(
          (source) =>
            !inactiveSources.has(source.status) ||
            // Leave room for a scheduled backup about to start during shutdown.
            (source.status === "IDLE" &&
              source.nextSnapshotTime &&
              Date.parse(source.nextSnapshotTime) <= Date.now() + 10_000),
        )
          ? "busy"
          : "idle";
      } catch {
        return "unknown";
      }
    }),
  );
  if (hasActiveRestores() || states.includes("busy")) return "busy";
  if (hasStartingVaults()) return "unknown";
  if (
    states.includes("unknown") ||
    current.length !== Object.keys(vaults).length ||
    current.some((vault) => vaults[vault.id] !== vault)
  )
    return "unknown";
  return "idle";
}
