const assert = require("node:assert/strict");
const { mkdir, rm, writeFile } = require("node:fs/promises");
const { dirname, join } = require("node:path");

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
  const sources = ["Documents", "Projects", "Designs", "Receipts"];
  async function file(path, content, repeats = 1) {
    const target = join(directory, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content.repeat(repeats));
  }
  await mkdir(join(directory, "Backups"));
  await mkdir(join(directory, "Recovered files"));
  for (const [path, content, repeats] of [
    ["Documents/notes.md", "# Notes\nA new idea.\n", 120],
    ["Documents/budget.csv", "Month,Amount\nNovember,250\n", 800],
    ["Documents/old-checklist.txt", "An earlier checklist.\n", 60],
    [
      "Documents/Guides/getting-started.md",
      "# Getting started\nKeep a copy of the files that matter.\n",
      100,
    ],
    [
      "Documents/Guides/household-inventory.csv",
      "Item,Location\nSpare cables,Office\n",
      600,
    ],
    [
      "Documents/Work/project-brief.md",
      "# Project brief\nA new home for the studio portfolio.\n",
      400,
    ],
    [
      "Documents/Work/meeting-notes.md",
      "# Meeting notes\nReview the first draft.\n",
      300,
    ],
    ["Documents/Travel/packing-list.txt", "Passport\nCamera\nNotebook\n", 20],
    ["Documents/Archive/old-plan.md", "# An earlier plan\n", 120],
    [
      "Documents/reading-list.md",
      "# Reading list\nDesign, photography and the outdoors.\n",
      80,
    ],
    [
      "Documents/contacts.csv",
      "Name,Email\nDemo contact,hello@example.com\n",
      180,
    ],
    ["Documents/home-inventory.csv", "Room,Item\nOffice,Desk\n", 500],
    [
      "Documents/recipes.md",
      "# Weekend recipes\nBread, soup and a little patience.\n",
      220,
    ],
    ["Projects/README.md", "# Weekend project\nIdeas and plans.\n", 120],
    ["Projects/tasks.csv", "Task,Status\nFirst draft,Complete\n", 900],
    [
      "Projects/website/index.html",
      "<!doctype html><title>Studio portfolio</title><h1>Made with care</h1>\n",
      1,
    ],
    [
      "Projects/data/catalog.csv",
      "Item,Category,Price\nNotebook,Stationery,12\n",
      25000,
    ],
    [
      "Designs/brand-guidelines.md",
      "# Studio identity\nTypography, spacing and color.\n",
      1800,
    ],
    [
      "Designs/palette.json",
      '{"ink":"#1b1f27","paper":"#f6f7f9","blue":"#1d4ed8"}\n',
      1,
    ],
    [
      "Receipts/2026/purchases.csv",
      "Date,Description,Amount\n2026-11-01,Office supplies,24.50\n",
      3000,
    ],
    [
      "Receipts/2026/expenses.csv",
      "Month,Category,Amount\nNovember,Travel,120\n",
      4000,
    ],
  ])
    await file(path, content, repeats);

  async function capturePair(name, dialogOnly = false) {
    for (const theme of ["light", "dark"]) {
      console.info(`Capturing ${name}-${theme}`);
      await contents.executeJavaScript(
        `window.electron.store.set('preferences.theme', ${JSON.stringify(theme)})`,
      );
      await waitFor(
        contents,
        `document.body.classList.contains('dark') === ${theme === "dark"}`,
      );
      // Crop dialog captures to the actual rendered bounds, without altering UI.
      const rectangle = dialogOnly
        ? await contents.executeJavaScript(`(() => {
        const rect = document.querySelector('[role=dialog]').getBoundingClientRect();
        return {x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height)};
      })()`)
        : undefined;
      await capture(contents, `${name}-${theme}`, rectangle);
    }
  }

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
  for (const source of sources) {
    const path = join(directory, source);
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
      await file("Documents/budget.csv", "Month,Amount\nNovember,325\n", 1000);
      await file(
        "Documents/Work/project-brief.md",
        "# Project brief\nPortfolio layout approved. Prepare the final designs.\n",
        480,
      );
      await file(
        "Documents/Work/meeting-notes.md",
        "# Meeting notes\nFirst draft approved. Next review on Friday.\n",
        350,
      );
      await file(
        "Documents/Work/launch-checklist.md",
        "# Launch checklist\nReview content. Check links. Publish.\n",
        60,
      );
      await file(
        "Documents/Travel/itinerary.md",
        "# A weekend away\nTrain tickets, walking routes and places to visit.\n",
        180,
      );
      await file(
        "Documents/Guides/recovery-notes.md",
        "# Recovery notes\nKeep a separate copy and try a restore.\n",
        100,
      );
      await rm(join(documents, "Archive", "old-plan.md"));
      await rm(join(documents, "Travel", "packing-list.txt"));
      await backUp(2);
    }
  }

  await contents.executeJavaScript(
    `location.hash = ${JSON.stringify(vaultRoute)}`,
  );
  await text(contents, "Documents");
  await text(contents, "Projects");
  await waitFor(contents, "!document.querySelector('.react-loading-skeleton')");
  await capturePair("vault");
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
  contents.setZoomFactor(0.8);
  await capturePair("comparison");
  contents.setZoomFactor(1);

  await contents.executeJavaScript(
    `location.hash = ${JSON.stringify(routes[0])}`,
  );
  await tabTo(
    contents,
    "document.activeElement?.getAttribute('aria-label')?.startsWith('Browse files in backup')",
  );
  await key(contents, "Return");
  await text(contents, "Restore folder");
  await text(contents, "travel-plans.md");
  await waitFor(contents, "!document.querySelector('.react-loading-skeleton')");
  await capturePair("browser");
  await activate(contents, "Restore folder");
  await text(contents, "Select destination folder path");
  select(join(directory, "Recovered files"));
  await activate(contents, "Select destination folder path");
  await text(contents, join(directory, "Recovered files"));
  await capturePair("restore", true);
  await key(contents, "Escape");
  await waitFor(contents, "!document.querySelector('[role=dialog]')");

  await contents.executeJavaScript(
    `location.hash = ${JSON.stringify(`${vaultRoute.replace(/\/$/, "")}/policies`)}`,
  );
  await text(contents, "Backup schedule");
  await waitFor(contents, "!document.querySelector('.react-loading-skeleton')");
  await capturePair("policies");

  contents.setZoomFactor(0.8);
  await contents.executeJavaScript("location.hash = '#/local/activity'");
  await text(contents, "5 retained snapshots");
  await waitFor(contents, "!document.body.innerText.includes('Refreshing…')");
  await capturePair("activity");
  contents.setZoomFactor(1);

  await contents.executeJavaScript("location.hash = '#/local'");
  await text(contents, "Create a new vault");
  await activate(contents, "Create a new vault");
  await waitFor(
    contents,
    "document.querySelector('input[aria-label=\"Search storage providers\"]')",
  );
  await capturePair("connections-local", true);
  for (const [name, label, block] of [
    ["connections-cloud", "Google Cloud", "start"],
    ["connections-remote", "WebDAV", "end"],
  ]) {
    await contents.executeJavaScript(
      `Array.from(document.querySelectorAll('[role=dialog] button')).find(button => button.textContent.trim().startsWith(${JSON.stringify(label)})).scrollIntoView({block: ${JSON.stringify(block)}, behavior: 'instant'})`,
    );
    await capturePair(name, true);
  }
  console.info(
    "Website/README captures: 9 views in both themes; 4 sources, 5 real snapshots, comparison, browsing, restore controls, policies, Activity and 3 provider-picker positions. Cold-start comparison label passed.",
  );
};
