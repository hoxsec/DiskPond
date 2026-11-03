import "../../apps/electron/src/identity.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app } from "electron";
import {
  corePath,
  globalConfigDirectory,
} from "../../apps/electron/src/path.ts";
import {
  listRestores,
  restoreDirectory,
} from "../../apps/electron/src/restore.ts";
import { getUpdateActivity } from "../../apps/electron/src/update-activity.ts";
import { fetchVault } from "../../apps/electron/src/vault/fetch.ts";
import {
  connectVault,
  stopAllVaults,
  vaults,
} from "../../apps/electron/src/vault/manage.ts";

const directory = globalConfigDirectory();
const password = "Disposable-update-fixture-password";
const id = "vlt_update_fixture";
const source = join(directory, "source");
const destination = join(directory, "restored");
let finished = false;
const timer = setTimeout(
  () => finish(new Error("Update activity timeout")),
  100_000,
);
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  stopAllVaults();
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
}
process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);
async function wait(check) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(25);
  }
  throw new Error("Engine activity timeout");
}
async function request(path, data) {
  const result = await fetchVault(vaults[id], {
    method: data ? "POST" : "GET",
    path: `/api/v1/${path}`,
    data,
  });
  assert.ok(!result.code && !result.error, JSON.stringify(result));
  return result;
}
void app.whenReady().then(async () => {
  try {
    const version = execFileSync(corePath(), ["--version"], {
      encoding: "utf8",
    }).trim();
    assert.ok(version.includes("0f31eefe409cb4f0571baf65abd7d063784598cd"));
    const repository = join(directory, "repository");
    await mkdir(repository);
    await mkdir(source);
    await mkdir(destination);
    const cli = (args) =>
      execFileSync(
        corePath(),
        [
          "--config-file",
          join(directory, "seed.config"),
          "--no-persist-credentials",
          "--disable-repository-log",
          ...args,
        ],
        {
          encoding: "utf8",
          timeout: 30_000,
          env: {
            ...process.env,
            KOPIA_PASSWORD: password,
            KOPIA_CACHE_DIRECTORY: join(directory, "cli-cache"),
          },
        },
      );
    cli(["repo", "create", "filesystem", "--path", repository]);
    cli(["maintenance", "set", "--enable-quick=false", "--enable-full=false"]);
    for (let index = 0; index < 32; index++)
      await writeFile(join(source, `${index}.bin`), randomBytes(1024 * 1024));
    const connected = await connectVault({
      id,
      name: "Update fixture",
      provider: "INTERNAL_DRIVE",
      config: { path: repository },
      password,
    });
    assert.ok(!connected.code && !connected.error, JSON.stringify(connected));
    await wait(async () => (await getUpdateActivity()) === "idle");
    await request("sources", {
      path: source,
      policy: { scheduling: { manual: true } },
      createSnapshot: true,
    });
    assert.equal(
      await getUpdateActivity(),
      "busy",
      "A live backup must block installation",
    );
    const snapshot = await wait(async () => {
      const { sources } = await request("sources");
      return sources.find(
        (item) => item.source.path === source && item.status === "IDLE",
      )?.lastSnapshot;
    });
    await wait(async () => (await getUpdateActivity()) === "idle");
    await restoreDirectory({
      vaultId: id,
      sourceId: source,
      objectId: snapshot.rootEntry.obj,
      options: {
        type: "UNPACKED",
        directoryPath: destination,
        confirmed: false,
      },
    });
    assert.equal(
      await getUpdateActivity(),
      "busy",
      "A native restore must block installation",
    );
    const restored = await wait(async () =>
      (await listRestores({ sourceId: source })).find(
        (item) => item.status !== "RUNNING" && item.status !== "CANCELING",
      ),
    );
    assert.equal(restored.status, "COMPLETE", JSON.stringify(restored));
    await wait(async () => (await getUpdateActivity()) === "idle");
    const hash = async (path) =>
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
    for (let index = 0; index < 32; index++)
      assert.equal(
        await hash(join(source, `${index}.bin`)),
        await hash(join(destination, `${index}.bin`)),
      );
    await writeFile(
      join(directory, "result.json"),
      JSON.stringify(
        {
          version,
          backupBlocksInstall: true,
          restoreBlocksInstall: true,
          idleAfterCompletion: true,
          restoredHashes: 32,
        },
        null,
        2,
      ),
    );
    console.info(
      "PASS: real backup/restore block updates; idle after completion; 32 restored hashes match",
    );
    finish();
  } catch (error) {
    finish(error);
  }
});
