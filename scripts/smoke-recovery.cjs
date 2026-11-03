const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} = require("node:fs/promises");
const { join } = require("node:path");

// Reuse the built-app keyboard driver. Only native picker responses are injected;
// source creation, backup, browsing and restore use production UI/preload/core.
module.exports = async function recovery({
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
}) {
  const source = join(directory, "source");
  const statePath = join(directory, "recovery.json");
  const phase = process.env.DISKPOND_RECOVERY_PHASE;
  const remoteRequests = [];
  contents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const remote =
      ["http:", "https:", "ws:", "wss:"].includes(url.protocol) &&
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (remote) remoteRequests.push(`${url.protocol}//${url.host}`);
    callback({ cancel: remote });
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
    await activate(contents, count === 1 ? "Backup now" : "Backup folder");
    const prefix = `/${sourceRoute.replace(/\/$/, "")}/`;
    await waitFor(
      contents,
      `[...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(href => href.startsWith(${JSON.stringify(prefix)}) && href.slice(${prefix.length}).split('/').length === 2))].length === ${count}`,
    ).catch(async (error) => {
      console.error("Snapshot links:", await links());
      throw error;
    });
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
    await writeFile(
      join(source, "large.bin"),
      Buffer.alloc(32 * 1024 * 1024, 0x5a),
    );
    await text(contents, "Open DiskPond");
    await activate(contents, "Open DiskPond");
    await text(contents, "Create a new vault");
    await destination(contents, "CREATE", "vault");
    await text(contents, "Confirm encryption password");
    await fill(contents, "name", "Recovery vault");
    await fill(contents, "password", " exact recovery password 雪 ");
    await fill(contents, "confirmPassword", " exact recovery password 雪 ");
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
  } else {
    state = JSON.parse(await readFile(statePath, "utf8"));
    await text(contents, "Vaults");
  }

  for (const [index, snapshot] of state.snapshots.entries()) {
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
    const output = join(directory, `${phase}-${index}`);
    await mkdir(output);
    select(output);
    await activate(contents, "Restore folder");
    await text(contents, "Unpacked files");
    await activate(contents, "Select destination folder path");
    await text(contents, output);
    await tabTo(
      contents,
      "document.activeElement?.matches('button[type=submit]') && document.activeElement.textContent.trim() === 'Restore'",
    );
    await key(contents, "Return");
    await waitFor(contents, "!document.querySelector('[role=dialog]')");
    await waitFor(
      contents,
      "[...document.querySelectorAll('[role=status]')].some(node => node.textContent.trim() === 'Restore completed')",
    );
    assert.deepEqual(await inventory(output), snapshot.expected);
    await capture(contents, `recovery-${phase}-${index}`);
    await activate(contents, "Dismiss result");
    await waitFor(
      contents,
      "![...document.querySelectorAll('button')].some(node => node.textContent.trim() === 'Dismiss result')",
    );
    console.info(
      `Recovery ${phase} snapshot ${index ? "B" : "A"}: hashes, entries and file mtimes match.`,
    );
  }
  assert.deepEqual(remoteRequests, [], "Unexpected Chromium remote requests");
};
