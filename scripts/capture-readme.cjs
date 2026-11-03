const assert = require("node:assert/strict");
const { mkdir, rm, writeFile } = require("node:fs/promises");
const { join } = require("node:path");

// Capture the built application with real snapshots in disposable local storage.
// Native picker responses and the demo identity are supplied by the shared driver.
module.exports = async function captureReadme({
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
  const documents = join(directory, "Documents");
  const projects = join(directory, "Projects");
  await mkdir(join(documents, "Guides"), { recursive: true });
  await mkdir(projects);
  await mkdir(join(directory, "Backups"));
  await writeFile(
    join(documents, "notes.md"),
    "# Notes\nA new idea.\n".repeat(120),
  );
  await writeFile(
    join(documents, "budget.csv"),
    "Month,Amount\nNovember,250\n".repeat(80),
  );
  await writeFile(
    join(documents, "old-checklist.txt"),
    "An earlier checklist.\n".repeat(60),
  );
  await writeFile(
    join(documents, "Guides", "getting-started.md"),
    "# Getting started\nKeep a copy of the files that matter.\n".repeat(100),
  );
  await writeFile(
    join(projects, "README.md"),
    "# Weekend project\nIdeas and plans.\n".repeat(120),
  );
  await writeFile(
    join(projects, "tasks.csv"),
    "Task,Status\nFirst draft,Complete\n".repeat(90),
  );

  await text(contents, "Open DiskPond");
  await activate(contents, "Open DiskPond");
  await contents.executeJavaScript(
    "window.electron.store.set('preferences.theme', 'dark')",
  );
  await text(contents, "Create a new vault");
  await destination(contents, "CREATE", "Backups");
  await text(contents, "Confirm encryption password");
  await fill(contents, "name", "Personal backup");
  await fill(contents, "password", "disposable-readme-fixture");
  await fill(contents, "confirmPassword", "disposable-readme-fixture");
  await activate(contents, "Create vault");
  await waitFor(contents, "!document.querySelector('[role=dialog]')");
  await text(contents, "Add file/folder");
  const vaultRoute = await contents.executeJavaScript("location.hash");
  const routes = [];

  async function backUp(count) {
    await activate(contents, count === 1 ? "Backup now" : "Backup folder");
    await waitFor(
      contents,
      `new Set(Array.from(document.querySelectorAll('a[href]')).filter(link=>link.getAttribute('aria-label')?.startsWith('Browse files in backup')).map(link=>link.getAttribute('href'))).size === ${count}`,
    );
  }
  for (const path of [documents, projects]) {
    await contents.executeJavaScript(
      `location.hash = ${JSON.stringify(vaultRoute)}`,
    );
    await text(contents, "Add file/folder");
    await activate(contents, "Add file/folder");
    select(path);
    await activate(contents, "Select folder path");
    await text(contents, path);
    await activate(contents, "Add folder");
    await waitFor(contents, "!document.querySelector('[role=dialog]')");
    await text(contents, "No backups yet");
    // This is reached before Activity or comparison can preload history.json.
    await text(contents, "Compare backups");
    assert.ok(
      await contents.executeJavaScript(
        "!document.body.innerText.includes('comparison.title')",
      ),
    );
    routes.push(await contents.executeJavaScript("location.hash"));
    await backUp(1);
    if (path === documents) {
      await writeFile(
        join(documents, "notes.md"),
        "# Notes\nA new idea, with the next steps added.\n".repeat(160),
      );
      await rm(join(documents, "old-checklist.txt"));
      await writeFile(
        join(documents, "travel-plans.md"),
        "# Travel plans\nTickets, packing and places to visit.\n".repeat(80),
      );
      await backUp(2);
    }
  }

  await contents.executeJavaScript(
    `location.hash = ${JSON.stringify(vaultRoute)}`,
  );
  await text(contents, "Documents");
  await text(contents, "Projects");
  await waitFor(contents, "!document.querySelector('.react-loading-skeleton')");
  await capture(contents, "vault-dark");

  await contents.executeJavaScript(
    "window.electron.store.set('preferences.theme', 'light')",
  );
  await contents.executeJavaScript(
    `location.hash = ${JSON.stringify(routes[0])}`,
  );
  await text(contents, "Compare backups");
  await tabTo(
    contents,
    "document.activeElement?.matches('a') && document.activeElement.textContent.trim()==='Compare backups'",
  );
  await key(contents, "Return");
  await text(contents, "Comparison finished");
  await text(contents, "travel-plans.md");
  await capture(contents, "comparison-light");

  await contents.executeJavaScript(
    "window.electron.store.set('preferences.theme', 'dark')",
  );
  await contents.executeJavaScript("location.hash = '#/local/activity'");
  await text(contents, "3 retained snapshots");
  await waitFor(contents, "!document.body.innerText.includes('Refreshing…')");
  await capture(contents, "activity-dark");
  console.info(
    "README captures: real vault, two-version comparison and Activity; cold-start comparison label passed.",
  );
};
