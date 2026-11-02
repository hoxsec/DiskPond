import { setTimeout as delay } from "node:timers/promises";
import { fetchVault } from "@electron/vault/fetch";
import type { VaultInstance } from "@electron/vault/types";
import { z } from "zod";

const ZResult = z.object({
  connected: z.boolean().optional(),
  initTaskID: z.string().optional(),
  code: z.string().optional(),
  error: z.string().optional(),
});
export type ConnectionResult = { code?: string; error?: string };

// The core may return while initialization is still running, or return the
// request's pre-connect status. Confirm the terminal state before saving secrets.
export async function connectRepository(
  vault: VaultInstance,
  data: object,
  create = false,
): Promise<ConnectionResult> {
  const deadline = Date.now() + 120_000;
  let response = ZResult.safeParse(
    await fetchVault(vault, {
      method: "POST",
      path: `/api/v1/repo/${create ? "create" : "connect"}`,
      data: { ...data, syncWaitTimeSeconds: 1 },
      timeoutMs: 30_000,
    }),
  );
  let taskId: string | undefined;
  while (response.success) {
    const result = response.data;
    if (result.code || result.error)
      return {
        code: result.code || "CONNECTION_FAILED",
        error: result.error || "Connection failed",
      };
    if (result.connected) return {};
    taskId ||= result.initTaskID;
    if (taskId) {
      const task = z
        .object({ status: z.string(), errorMessage: z.string().optional() })
        .safeParse(
          await fetchVault(vault, {
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            timeoutMs: 5_000,
          }),
        );
      if (!task.success) break;
      if (["FAILED", "CANCELED"].includes(task.data.status))
        return {
          code: "CONNECTION_FAILED",
          error: task.data.errorMessage || "Connection failed",
        };
    }
    if (
      Date.now() >= deadline ||
      vault.server.process.killed ||
      vault.server.process.exitCode !== null
    )
      break;
    await delay(100);
    response = ZResult.safeParse(
      await fetchVault(vault, {
        method: "GET",
        path: "/api/v1/repo/status",
        timeoutMs: 5_000,
      }),
    );
  }
  vault.server.process.kill();
  return {
    code: "CONNECTION_FAILED",
    error: "The backup engine did not confirm the connection",
  };
}
