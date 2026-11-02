import { tryCatch } from "@blinkdisk/utils/try-catch";
import { log } from "@electron/log";
import { migrateStoreV1 } from "@electron/migrations/store_v1";
import { migrateWorkspaceV1 } from "@electron/migrations/workspace-v1";
import { type GlobalStorageType, store } from "@electron/store";

const migrations = [
  { id: "store_v1", execute: migrateStoreV1 },
  { id: "workspace_v1", execute: migrateWorkspaceV1 },
];

export async function runMigrations() {
  let completedMigrations =
    (store.get("migrations") as GlobalStorageType["migrations"]) || [];

  if (!completedMigrations || !Array.isArray(completedMigrations))
    completedMigrations = [];

  for (const migration of migrations) {
    const existing = completedMigrations.find((m) => m.id === migration.id);
    if (existing) continue;

    log.info(`Running migration ${migration.id}`);

    const [, error] = await tryCatch(migration.execute());

    if (error) {
      log.error(`Failed to execute migration ${migration.id}:`, error);
      continue;
    }

    log.info(`Migration ${migration.id} completed successfully`);

    completedMigrations.push({ id: migration.id, completedAt: new Date() });
  }

  store.set("migrations", completedMigrations);
}
