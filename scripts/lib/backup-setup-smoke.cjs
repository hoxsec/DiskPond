const assert = require("node:assert/strict");
const { mkdir, rename, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { app } = require("electron");

// Redirect Electron's known-folder lookups for this process only. The UI can
// exercise real source creation and snapshots without touching personal files.
exports.prepareFolders = async (directory) => {
  const folders = {
    documents: join(directory, "Users", "Sam", "Documents"),
    pictures: join(directory, "Photos"),
    desktop: join(directory, "Users", "Sam", "Desktop"),
    downloads: join(directory, "Users", "Sam", "Downloads"),
    music: join(directory, "Users", "Sam", "Music"),
    videos: join(directory, "Users", "Sam", "Videos"),
  };
  for (const [kind, path] of Object.entries(folders)) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, `${kind}.txt`), kind);
    app.setPath(kind, path);
  }
};

exports.verifyBackupSetup = async ({
  contents,
  directory,
  text,
  activate,
  key,
  tabTo,
  waitFor,
  capture,
  select,
}) => {
  const run = (code) => contents.executeJavaScript(code);
  await text(contents, "2 folders selected");
  const id = await run("location.hash.split('/').at(-1)");
  const api = (resource) =>
    run(
      `fetch('diskpondapp://vault/api/v1/${resource}', {headers:{'vault-id': ${JSON.stringify(id)}}}).then(r=>r.json())`,
    );
  const boxes =
    "Array.from(document.querySelectorAll('main input[type=checkbox]'))";
  const box = (label) =>
    `${boxes}.find(el=>document.getElementById(el.getAttribute('aria-labelledby')).textContent === ${JSON.stringify(label)})`;
  const toggle = async (name) => {
    await tabTo(contents, `document.activeElement === ${box(name)}`);
    await key(contents, "Space");
  };
  assert.deepEqual(
    await run(
      `${boxes}.map(el=>[document.getElementById(el.getAttribute('aria-labelledby')).textContent, el.checked])`,
    ),
    [
      ["Documents", true],
      ["Pictures", true],
      ["Desktop", false],
      ["Downloads", false],
      ["Music", false],
      ["Videos", false],
    ],
  );
  assert.equal(
    await run(
      `${box("Pictures")}.closest('label').querySelector('[title]').title`,
    ),
    app.getPath("pictures"),
  );
  await capture(contents, "suggested-folders-light");
  await toggle("Documents");
  await toggle("Pictures");
  await text(contents, "0 folders selected");
  assert(
    await run(
      "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Review backup')).disabled",
    ),
  );
  await toggle("Documents");
  const custom = join(directory, "Projects");
  await mkdir(custom);
  await writeFile(join(custom, "project.txt"), "First backed-up project");
  const pick = async (path) => {
    select(path);
    await activate(contents, "Choose another folder");
    await waitFor(
      contents,
      "!document.querySelector('button[aria-busy=true]')",
    );
  };
  await pick(join(directory, "create-0"));
  await text(contents, "Choose an accessible folder");
  await pick(custom);
  await text(contents, "2 folders selected");
  await pick(custom);
  assert.equal(await run(`${boxes}.length`), 7);
  await activate(contents, "Review backup");
  await text(contents, "Step 3 of 3");
  await text(contents, custom);
  assert(
    !(await run(
      "document.querySelector('main').innerText.includes('Pictures')",
    )),
  );
  assert.equal((await api("sources")).sources.length, 0);
  assert.equal((await api("snapshots")).snapshots.length, 0);
  await activate(contents, "Back");
  await text(contents, "2 folders selected");
  await activate(contents, "Review backup");

  await rename(custom, `${custom}-offline`);
  await activate(contents, "Start backup");
  await text(contents, "1 folder selected");
  await text(contents, "couldn’t be backed up");
  assert.equal((await api("sources")).sources.length, 1);
  await rename(`${custom}-offline`, custom);
  await activate(contents, "Start backup");
  await text(contents, "Add file/folder");
  const state = await api("sources");
  const sources = state.sources.map((item) => item.source.path).sort();
  assert.deepEqual(sources, [app.getPath("documents"), custom].sort());
  const snapshots = await run(`(async () => {
    const until = Date.now() + 20000;
    do {
      const {snapshots} = await fetch('diskpondapp://vault/api/v1/snapshots', {headers:{'vault-id': ${JSON.stringify(id)}}}).then(r=>r.json());
      const completed = snapshots.filter(s=>!s.incomplete);
      if (completed.length >= 2) return completed.length;
      await new Promise(r=>setTimeout(r,100));
    } while(Date.now() < until);
    throw new Error('First backups did not complete');
  })()`);
  assert.equal(snapshots, 2);
  for (const path of sources) {
    const list = await api(
      `snapshots?${new URLSearchParams({ path, host: state.localHost, userName: state.localUsername, all: "1" })}`,
    );
    assert.equal(list.snapshots.length, 1);
    assert.ok(list.snapshots[0].rootID);
  }
  await activate(contents, "Suggested folders");
  await text(contents, "Already in this vault");
  assert(await run(`${box("Documents")}.disabled`));
  await activate(contents, "Skip for now");
};
