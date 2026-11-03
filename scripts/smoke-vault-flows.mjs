import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { coreBuildTarget } from "../libs/constants/src/core.ts";
import {
  completed,
  electronDirectory,
  pnpm,
  root,
  run,
} from "./lib/process.mjs";

const directory = await mkdtemp(
  join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-vault-flows-"),
);
const require = createRequire(resolve(electronDirectory, "package.json"));
const target = coreBuildTarget(process.platform, process.arch);
let deniedSid;
try {
  for (const name of [
    "existing",
    "empty",
    "unrelated",
    "corrupt",
    "create-0",
    "create-1",
  ])
    await mkdir(join(directory, name));
  await writeFile(join(directory, "unrelated", "keep.txt"), "preserve");
  await writeFile(join(directory, "corrupt", "kopia.repository.f"), "{invalid");
  if (process.platform === "win32") {
    const sid = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], {
      encoding: "utf8",
    }).match(/S-1-[0-9-]+/)?.[0];
    if (!sid)
      throw new Error("Could not identify the fixture user for the ACL check");
    await mkdir(join(directory, "denied"));
    deniedSid = sid;
    execFileSync(
      "icacls",
      [join(directory, "denied"), "/deny", `*${sid}:(OI)(CI)(F)`],
      { stdio: "pipe" },
    );
  }
  execFileSync(
    resolve(root, "apps/core/dist", target.directory, target.executable),
    [
      "--config-file",
      join(directory, "seed.config"),
      "--no-persist-credentials",
      "--disable-repository-log",
      "repo",
      "create",
      "filesystem",
      "--path",
      join(directory, "existing"),
    ],
    {
      timeout: 60_000,
      env: {
        ...process.env,
        KOPIA_PASSWORD: "existing-fixture-password",
        KOPIA_CHECK_FOR_UPDATES: "false",
        KOPIA_CACHE_DIRECTORY: join(directory, "cache"),
        KOPIA_LOG_DIR: join(directory, "logs"),
      },
      stdio: "pipe",
    },
  );
  await completed(
    pnpm(["--filter", "@blinkdisk/electron", "exec", "install-electron"]),
  );
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
          DISKPOND_VAULT_PHASE: phase,
        },
        timeout: 180_000,
      },
    );
} finally {
  if (deniedSid)
    execFileSync(
      "icacls",
      [join(directory, "denied"), "/remove:d", `*${deniedSid}`],
      { stdio: "pipe" },
    );
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
