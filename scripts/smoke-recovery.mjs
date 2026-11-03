import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { electronDirectory, root, run } from "./lib/process.mjs";

const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-recovery-"),
);
const require = createRequire(resolve(electronDirectory, "package.json"));
try {
  await mkdir(join(directory, "vault"));
  for (const phase of ["setup", "restart"])
    await run(
      require("electron"),
      [resolve(root, "scripts/smoke-vault-flows.cjs")],
      {
        cwd: electronDirectory,
        env: {
          ...process.env,
          DISKPOND_PREVIEW: "1",
          DISKPOND_DATA_DIR: join(directory, "app-data"),
          DISKPOND_VAULT_FIXTURE: directory,
          DISKPOND_VAULT_PHASE: `recovery-${phase}`,
          DISKPOND_RECOVERY_PHASE: phase,
        },
        timeout: 255_000,
      },
    );
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
