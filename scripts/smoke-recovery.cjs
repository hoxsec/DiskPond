const assert = require("node:assert/strict");
const { createHash, randomBytes } = require("node:crypto");
const {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} = require("node:fs/promises");
const { join } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { app } = require("electron");

// Reuse the built-app keyboard driver. Only native picker responses are injected;
// source creation, backup, browsing and restore use production UI/preload/core.
module.exports = async function recovery(options) {
  if (process.env.DISKPOND_RECOVERY_PHASE === "restart") {
    await options.text(options.contents, "Vaults");
    options.contents = await options.reopen();
    await options.text(options.contents, "Vaults");
    assert.equal(
      await options.contents.executeJavaScript(
        "window.electron.store.get('preferences.theme')",
      ),
      "dark",
    );
  }
  for (const vaultIndex of [0, 1])
    await recoverVault({ ...options, vaultIndex });
  assert.deepEqual(
    options.networkRequests,
    [],
    "Unexpected remote Chromium/main-fetch requests",
  );
};

async function recoverVault({
  contents,
  directory,
  activate,
  fill,
  text,
  waitFor,
  tabTo,
  key,
  destination,
  capture,
  select,
  vaultIndex,
  interrupt,
}) {
  const source = join(directory, `source-${vaultIndex}`);
  const statePath = join(directory, `recovery-${vaultIndex}.json`);
  const phase = process.env.DISKPOND_RECOVERY_PHASE;
  const measurements = [];
  const measure = (operation, started) =>
    measurements.push({
      operation,
      milliseconds: Math.round(performance.now() - started),
      electronWorkingSetKiB: app
        .getAppMetrics()
        .reduce((sum, metric) => sum + metric.memory.workingSetSize, 0),
    });

  async function inventory(root, prefix = "") {
    const result = {};
    for (const entry of (
      await readdir(join(root, prefix), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        result[name] = { type: "directory" };
        Object.assign(result, await inventory(root, name));
      } else {
        assert(entry.isFile(), "Unexpected fixture entry type");
        const path = join(root, name);
        result[name] = {
          type: "file",
          hash: createHash("sha256")
            .update(await readFile(path))
            .digest("hex"),
          modified: Math.round((await stat(path)).mtimeMs / 1000),
        };
      }
    }
    return result;
  }
  async function follow(href) {
    await tabTo(
      contents,
      `document.activeElement?.getAttribute('href') === ${JSON.stringify(href)}`,
    );
    await key(contents, "Return");
  }
  const links = () =>
    contents.executeJavaScript(
      "[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))",
    );
  async function backup(count, sourceRoute) {
    const started = performance.now();
    await activate(contents, count === 1 ? "Backup now" : "Backup folder");
    const prefix = `/${sourceRoute.replace(/\/$/, "")}/`;
    await waitFor(
      contents,
      `[...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(href => href.startsWith(${JSON.stringify(prefix)}) && href.slice(${prefix.length}).split('/').length === 2))].length === ${count}`,
    ).catch(async (error) => {
      console.error("Snapshot links:", await links());
      throw error;
    });
    measure(`backup-${count}`, started);
    return [
      ...new Set(
        (await links()).filter(
          (href) =>
            href.startsWith(prefix) &&
            href.slice(prefix.length).split("/").length === 2,
        ),
      ),
    ];
  }
  let state;
  if (phase === "setup") {
    await mkdir(join(source, "nested 雪", "empty-folder"), { recursive: true });
    await writeFile(join(source, "empty.txt"), "");
    await writeFile(
      join(source, "deleted.txt"),
      "Recover this from snapshot A",
    );
    await writeFile(join(source, "nested 雪", "changed.txt"), "Version A");
    await writeFile(join(source, "large.bin"), randomBytes(32 * 1024 * 1024));
    if (!vaultIndex)
      for (let i = 0; i < 512; i++)
        await writeFile(
          join(source, `entry-${String(i).padStart(4, "0")}.txt`),
          `Entry ${i}`,
        );
    if (!vaultIndex) {
      await text(contents, "Open DiskPond");
      await activate(contents, "Open DiskPond");
    } else {
      await contents.executeJavaScript("location.hash = '#/local'");
    }
    await text(contents, "Create a new vault");
    await destination(contents, "CREATE", `vault-${vaultIndex}`);
    await text(contents, "Confirm encryption password");
    await fill(contents, "name", `Recovery vault ${vaultIndex}`);
    await fill(
      contents,
      "password",
      ` exact recovery password 雪 ${vaultIndex} `,
    );
    await fill(
      contents,
      "confirmPassword",
      ` exact recovery password 雪 ${vaultIndex} `,
    );
    await activate(contents, "Create vault");
    await waitFor(contents, "!document.querySelector('[role=dialog]')");
    await text(contents, "Add file/folder");
    await activate(contents, "Add file/folder");
    select(source);
    await activate(contents, "Select folder path");
    await text(contents, source);
    await activate(contents, "Add folder");
    await waitFor(contents, "!document.querySelector('[role=dialog]')");
    await text(contents, "No backups yet");
    const sourceRoute = await contents.executeJavaScript("location.hash");
    const expectedA = await inventory(source);
    const [a] = await backup(1, sourceRoute);
    await writeFile(
      join(source, "nested 雪", "changed.txt"),
      "Version B, changed contents",
    );
    await rm(join(source, "deleted.txt"));
    await writeFile(join(source, "added.txt"), "Only in snapshot B");
    const expectedB = await inventory(source);
    const snapshots = await backup(2, sourceRoute);
    const b = snapshots.find((href) => href !== a);
    assert(b, "Snapshot B must have a distinct identity");
    state = {
      sourceRoute,
      snapshots: [
        { href: a, expected: expectedA },
        { href: b, expected: expectedB },
      ],
    };
    await writeFile(statePath, JSON.stringify(state));
    if (!vaultIndex) {
      const vaultId = sourceRoute.split("/")[2];
      const tasks = () =>
        contents.executeJavaScript(
          `fetch('diskpondapp://vault/api/v1/tasks', { headers: { 'vault-id': ${JSON.stringify(vaultId)} } }).then(response => response.json()).then(result => result.tasks)`,
        );
      const previous = new Set((await tasks()).map((task) => task.id));
      await waitFor(
        contents,
        "[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Backup folder' && !button.disabled)",
      );
      const started = performance.now();
      await activate(contents, "Backup folder");
      let terminal;
      while (performance.now() - started < 60_000) {
        terminal = (await tasks()).find(
          (task) =>
            task.kind === "Snapshot" &&
            !previous.has(task.id) &&
            ["SUCCESS", "FAILED", "CANCELED"].includes(task.status),
        );
        if (terminal) break;
        await delay(100);
      }
      assert.equal(
        terminal?.status,
        "SUCCESS",
        "Unchanged backup must finish successfully",
      );
      measure("backup-unchanged", started);
    }
  } else {
    state = JSON.parse(await readFile(statePath, "utf8"));
    await contents.executeJavaScript("location.hash = '#/local'");
    await text(contents, "Vaults");
    if (vaultIndex === 0) {
      const vaultId = state.sourceRoute.split("/")[2];
      await contents.executeJavaScript(
        `location.hash = ${JSON.stringify(state.sourceRoute)}`,
      );
      await text(contents, "Backup folder");
      await interrupt(vaultId);
      await text(contents, "Retry");
      const repository = join(directory, `vault-${vaultIndex}`);
      const detached = `${repository}-detached`;
      await rename(repository, detached);
      try {
        await activate(contents, "Retry");
        await text(contents, "Starting vault");
        await text(contents, "Retry");
      } finally {
        await rename(detached, repository);
      }
      await activate(contents, "Retry");
      await text(contents, "Backup folder");
      console.info(
        "Recovery: engine exit and unavailable storage show Retry; reattached storage reconnects.",
      );
    }
  }

  for (const [index, snapshot] of state.snapshots.entries()) {
    await contents.executeJavaScript(`window.electron.zoom(${index ? 2 : 1})`);
    await contents.executeJavaScript(
      `window.electron.store.set('preferences.theme', ${JSON.stringify(index ? "dark" : "light")})`,
    );
    // Navigate to saved source, then keyboard-open its real snapshot link.
    await contents.executeJavaScript(
      `location.hash = ${JSON.stringify(state.sourceRoute)}`,
    );
    await waitFor(
      contents,
      `[...document.querySelectorAll('a[href]')].some(a => a.getAttribute('href') === ${JSON.stringify(snapshot.href)})`,
    );
    await follow(snapshot.href);
    await text(contents, index ? "added.txt" : "deleted.txt");
    if (!vaultIndex && !index) {
      const started = performance.now();
      await tabTo(
        contents,
        "document.activeElement?.getAttribute('placeholder') === 'Search for files or folders...'",
      );
      await contents.insertText("entry-0511.txt");
      await text(contents, "entry-0511.txt");
      await key(contents, "A", ["control"]);
      await key(contents, "Backspace");
      await text(contents, "deleted.txt");
      measure("browse-filter-512", started);
    }
    const output = join(directory, `${phase}-${vaultIndex}-${index}`);
    await mkdir(output);
    select(output);
    if (!vaultIndex && !index) {
      await tabTo(
        contents,
        "document.activeElement?.matches('button') && document.activeElement.textContent.trim() === 'Restore folder'",
        ["shift"],
      );
      await key(contents, "Return");
    } else await activate(contents, "Restore folder");
    await text(contents, "Unpacked files");
    await activate(contents, "Select destination folder path");
    await text(contents, output);
    await tabTo(
      contents,
      "document.activeElement?.matches('button[type=submit]') && document.activeElement.textContent.trim() === 'Restore'",
    );
    await key(contents, "Return");
    const started = performance.now();
    await waitFor(contents, "!document.querySelector('[role=dialog]')");
    await waitFor(
      contents,
      "[...document.querySelectorAll('[role=status]')].some(node => node.textContent.trim() === 'Restore completed')",
    );
    assert.deepEqual(await inventory(output), snapshot.expected);
    measure(`restore-${index}`, started);
    await capture(contents, `recovery-${phase}-${vaultIndex}-${index}`);
    await activate(contents, "Dismiss result");
    await waitFor(
      contents,
      "![...document.querySelectorAll('button')].some(node => node.textContent.trim() === 'Dismiss result')",
    );
    console.info(
      `Recovery ${phase} vault ${vaultIndex} snapshot ${index ? "B" : "A"}: hashes, entries and file mtimes match.`,
    );
  }
  await contents.executeJavaScript("window.electron.zoom(1)");
  console.info(
    `Recovery measurements ${phase} vault ${vaultIndex}: ${JSON.stringify(measurements)}`,
  );
}
