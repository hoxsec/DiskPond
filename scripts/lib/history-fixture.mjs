import "../../apps/electron/src/identity.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { app } from "electron";
import { readActivityHistory } from "../../apps/desktop/src/lib/backup-activity.ts";
import {
  readHistoryDirectory,
  readSnapshotHistory,
} from "../../apps/desktop/src/lib/history.ts";
import {
  latestSourceSuccess,
  summarizeProtection,
} from "../../apps/desktop/src/lib/protection-status.ts";
import { compareSnapshots } from "../../apps/desktop/src/lib/snapshot-comparison.ts";
import {
  corePath,
  globalConfigDirectory,
} from "../../apps/electron/src/path.ts";
import { fetchVaultRaw } from "../../apps/electron/src/vault/fetch.ts";
import {
  connectVault,
  stopAllVaults,
  vaults,
} from "../../apps/electron/src/vault/manage.ts";
import { startVaultServer } from "../../apps/electron/src/vault/server.ts";

const directory = globalConfigDirectory();
const password = "Disposable-history-fixture-only-雪";
const pin = process.env.DISKPOND_CORE_REVISION;
const source = join(directory, "source");
const rootFile = join(directory, "single.txt");
const signal = new AbortController().signal;
let finished = false;
const watchdog = setTimeout(
  () => finish(new Error("History fixture timed out")),
  160_000,
);
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  stopAllVaults();
  if (error) console.error(error);
  app.exit(error ? 1 : 0);
}
process.on("uncaughtException", finish);
process.on("unhandledRejection", finish);

function cli(name, args) {
  return execFileSync(
    corePath(),
    [
      "--config-file",
      join(directory, `${name}.config`),
      "--no-persist-credentials",
      "--disable-repository-log",
      ...args,
    ],
    {
      encoding: "utf8",
      timeout: 40_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        KOPIA_PASSWORD: password,
        KOPIA_CACHE_DIRECTORY: join(directory, "cli-cache", name),
      },
    },
  );
}

async function wait(check) {
  const until = Date.now() + 15_000;
  while (Date.now() < until) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error("Engine result timeout");
}

async function request(vaultId, path, body) {
  const data = await fetchVaultRaw(vaults[vaultId], {
    method: body ? "POST" : "GET",
    path: `/api/v1/${path}`,
    data: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(!data.error && !data.code, JSON.stringify(data));
  return data;
}

// Exercise production renderer validation/read/comparison logic with the real,
// authenticated native transport. Only this disposable process replaces fetch.
globalThis.fetch = async (url, options) => {
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "vault");
  assert.equal(options.method, "GET");
  const id = new Headers(options.headers).get("vault-id");
  const data = await fetchVaultRaw(vaults[id], {
    method: "GET",
    path: `${parsed.pathname}${parsed.search}`,
    signal: options.signal,
  });
  return new Response(JSON.stringify(data));
};

void app.whenReady().then(async () => {
  try {
    const version = execFileSync(corePath(), ["--version"], {
      encoding: "utf8",
    }).trim();
    assert.ok(pin && version.includes(pin), version);
    const evidence = { version, vaults: [], symlink: "pending" };
    for (const index of [0, 1]) {
      const id = `vlt_history_fixture_${index}`;
      const name = `seed-${index}`;
      const repository = join(directory, `repository-${index}`);
      await mkdir(repository);
      cli(name, [
        "repo",
        "create",
        "filesystem",
        "--path",
        repository,
        "--override-hostname=fixture-device",
        "--override-username=fixture-user",
      ]);
      cli(name, [
        "maintenance",
        "set",
        "--enable-quick=false",
        "--enable-full=false",
      ]);
      await rm(source, { recursive: true, force: true });
      await mkdir(join(source, "nested", "empty"), { recursive: true });
      await mkdir(join(source, "unchanged-dir"));
      await writeFile(join(source, "unchanged-dir", "keep.txt"), "same data");
      await writeFile(join(source, "edit.txt"), "AAAA");
      // Use a whole-second fixture timestamp so Node's millisecond Date does
      // not discard Windows' 100 ns precision when restoring the same mtime.
      await utimes(
        join(source, "edit.txt"),
        new Date("2026-02-01"),
        new Date("2026-02-01"),
      );
      await writeFile(join(source, "meta.txt"), "metadata");
      await writeFile(join(source, "deleted.txt"), "gone in B");
      await writeFile(join(source, "replace"), "file in A");
      await writeFile(join(source, "empty.txt"), "");
      await writeFile(join(source, "nested", "雪.txt"), "Unicode unchanged");
      let linked = false;
      try {
        await symlink("edit.txt", join(source, "link"), "file");
        linked = true;
        evidence.symlink = "real file symlink";
      } catch (error) {
        if (error.code !== "EPERM") throw error;
        evidence.symlink =
          "OS file-symlink privilege unavailable; comparator unit fixture covers links";
      }
      const a = JSON.parse(cli(name, ["snapshot", "create", source, "--json"]));
      const editTime = await stat(join(source, "edit.txt"));
      await writeFile(join(source, "edit.txt"), "BBBB");
      await utimes(join(source, "edit.txt"), editTime.atime, editTime.mtime);
      await utimes(
        join(source, "meta.txt"),
        new Date("2026-01-01"),
        new Date("2026-01-01"),
      );
      await rm(join(source, "deleted.txt"));
      await rm(join(source, "replace"));
      await mkdir(join(source, "replace"));
      await writeFile(join(source, "replace", "child.txt"), "new child");
      await writeFile(join(source, "added.txt"), "added in B");
      if (linked) {
        await rm(join(source, "link"));
        await symlink("meta.txt", join(source, "link"), "file");
      }
      const b = JSON.parse(
        cli(name, ["snapshot", "create", source, "--json", "--force-hash=100"]),
      );
      const c = JSON.parse(
        cli(name, ["snapshot", "create", source, "--json", "--force-hash=100"]),
      );
      assert.equal(b.rootEntry.obj, c.rootEntry.obj);
      assert.notEqual(b.id, c.id);
      await writeFile(rootFile, "root A");
      cli(name, ["snapshot", "create", rootFile, "--json"]);
      await writeFile(rootFile, "root B");
      cli(name, ["snapshot", "create", rootFile, "--json", "--force-hash=100"]);
      const remote = `${name}-remote`;
      cli(remote, [
        "repo",
        "connect",
        "filesystem",
        "--path",
        repository,
        "--override-hostname=other-device",
        "--override-username=other-user",
      ]);
      cli(remote, ["snapshot", "create", source, "--json"]);
      process.env.KOPIA_CACHE_DIRECTORY = join(directory, "managed-cache", id);
      const connected = await connectVault({
        id,
        name: `History ${index}`,
        provider: "INTERNAL_DRIVE",
        config: { path: repository },
        password,
      });
      assert.ok(!connected.error && !connected.code, JSON.stringify(connected));
      const identity = {
        host: "fixture-device",
        userName: "fixture-user",
        path: source,
      };
      const history = await readSnapshotHistory(id, identity, signal);
      assert.equal(history.length, 3);
      const before = history.find((snapshot) => snapshot.id === a.id);
      const after = history.find((snapshot) => snapshot.id === b.id);
      const comparison = await compareSnapshots({
        before,
        after,
        signal,
        readDirectory: (object, signal) =>
          readHistoryDirectory(id, object, signal),
      });
      assert.equal(
        comparison.status,
        "complete",
        JSON.stringify(comparison.issues),
      );
      const changes = new Map(
        comparison.rows.map((row) => [row.path.join("/"), row]),
      );
      for (const [path, kind] of [
        ["added.txt", "added"],
        ["deleted.txt", "deleted"],
        ["edit.txt", "changed"],
        ["meta.txt", "changed"],
        ["replace", "changed"],
        ["replace/child.txt", "added"],
      ])
        assert.equal(changes.get(path)?.kind, kind, path);
      assert.equal(changes.has("unchanged-dir/keep.txt"), false);
      assert.equal(changes.has("nested/雪.txt"), false);
      assert.equal(
        changes.get("edit.txt").before.size,
        changes.get("edit.txt").after.size,
      );
      assert.equal(
        changes.get("edit.txt").before.mtime,
        changes.get("edit.txt").after.mtime,
      );
      assert.notEqual(
        changes.get("edit.txt").before.obj,
        changes.get("edit.txt").after.obj,
      );
      assert.equal(
        changes.get("meta.txt").before.obj,
        changes.get("meta.txt").after.obj,
      );
      if (linked) assert.equal(changes.get("link")?.kind, "changed");
      const identical = await compareSnapshots({
        before: after,
        after: history.find((snapshot) => snapshot.id === c.id),
        signal,
        readDirectory: () => {
          throw new Error("Identical subtree should not be read");
        },
      });
      assert.equal(identical.rows.length, 0);
      const files = await readSnapshotHistory(
        id,
        { ...identity, path: rootFile },
        signal,
      );
      assert.equal(files.length, 2);
      const single = await compareSnapshots({
        before: files[1],
        after: files[0],
        signal,
        readDirectory: () => {
          throw new Error("File data must not be read");
        },
      });
      assert.equal(single.rows.length, 1);
      assert.equal(single.rows[0].before.size, 6);
      assert.equal(single.rows[0].before.mtime, files[1].summary.maxTime);
      assert.equal(single.status, "complete");
      const activity = await readActivityHistory(id, signal);
      assert.equal(activity.records.length, 6);
      assert.equal(activity.unavailableSources.length, 0);
      assert.equal(
        new Set(activity.records.map((record) => record.source.userName)).size,
        2,
      );
      assert.equal(
        activity.records.filter((record) => record.outcome === "unknown")
          .length,
        0,
      );
      // Read-only comparison has not changed the retained set, and both saved
      // versions remain recoverable with their original bytes.
      for (const [snapshot, expected, suffix] of [
        [a, "AAAA", "a"],
        [b, "BBBB", "b"],
      ]) {
        const destination = join(directory, `restore-${index}-${suffix}`);
        cli(name, ["snapshot", "restore", snapshot.id, destination]);
        assert.equal(
          await readFile(join(destination, "edit.txt"), "utf8"),
          expected,
        );
      }
      const child = vaults[id].server.process;
      const exited = once(child, "exit");
      child.kill();
      await exited;
      delete vaults[id];
      vaults[id] = {
        id,
        status: "STARTING",
        server: await startVaultServer(id, false),
      };
      assert.equal((await readActivityHistory(id, signal)).records.length, 6);
      const missing = join(directory, `missing-source-${index}`);
      await mkdir(missing);
      await request(id, "sources", {
        path: missing,
        createSnapshot: false,
        policy: { scheduling: { manual: true } },
      });
      await rm(missing, { recursive: true });
      await request(
        id,
        `sources/upload?path=${encodeURIComponent(missing)}`,
        {},
      );
      const failed = await wait(async () =>
        (await request(id, "sources")).sources.find(
          (item) =>
            item.source.path === missing &&
            item.status === "IDLE" &&
            item.lastBackupOutcome?.status === "FAILED",
        ),
      );
      const withFailure = await readActivityHistory(id, signal);
      assert.ok(
        withFailure.sources.some(
          (item) => item.lastBackupOutcome?.id === failed.lastBackupOutcome.id,
        ),
      );
      assert.equal(withFailure.records.length, 6);
      const protection = (item) =>
        summarizeProtection([
          {
            id,
            name: "Disposable backup",
            status: "RUNNING",
            pending: false,
            unavailable: false,
            sources: [{ ...item, id: "local-source", type: "directory" }],
          },
        ]);
      assert.equal(protection(failed).state, "failed");
      assert.equal(latestSourceSuccess(failed), 0);
      await mkdir(missing);
      await writeFile(
        join(missing, "recover.txt"),
        "Protection action recovery",
      );
      const params = new URLSearchParams(failed.source);
      await request(id, `sources/upload?${params}`, {});
      const successful = await wait(async () => {
        const item = (await request(id, "sources")).sources.find(
          (item) => item.source.path === missing,
        );
        return item?.status === "IDLE" &&
          item.lastBackupOutcome?.status === "SUCCESS"
          ? item
          : null;
      });
      assert.equal(protection(successful).state, "manual");
      assert.ok(latestSourceSuccess(successful) > 0);
      const restored = join(directory, `protection-restore-${index}`);
      cli(name, ["snapshot", "restore", successful.lastSnapshot.id, restored]);
      assert.equal(
        await readFile(join(restored, "recover.txt"), "utf8"),
        "Protection action recovery",
      );
      const policyResult = await fetchVaultRaw(vaults[id], {
        method: "PUT",
        path: `/api/v1/policy?${params}`,
        data: JSON.stringify({ scheduling: { intervalSeconds: 86400 } }),
      });
      assert.ok(!policyResult?.error);
      const scheduled = await wait(async () => {
        const item = (await request(id, "sources")).sources.find(
          (item) => item.source.path === missing,
        );
        return item?.nextSnapshotTime ? item : null;
      });
      assert.equal(protection(scheduled).state, "current");
      assert.equal(
        protection(scheduled).nextBackup,
        Date.parse(scheduled.nextSnapshotTime),
      );
      evidence.vaults.push({
        id,
        retainedSnapshots: activity.records.length,
        comparisonPaths: comparison.rows.length,
        restart: "passed",
        failedWithoutSnapshot: "passed",
        twoVersionRecovery: "passed",
        protectionStatusAndRecovery: "passed",
      });
    }
    await writeFile(
      join(directory, "evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    console.info(JSON.stringify(evidence, null, 2));
    console.info(
      "Snapshot comparison and retained activity real-engine fixture passed.",
    );
    finish();
  } catch (error) {
    finish(error);
  }
});
