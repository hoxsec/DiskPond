import "@electron/identity";

import { listenProtocol, registerProtcol } from "@electron/protocol";
import { app } from "electron";

// Protocol privileges must be registered before the app ready event.
registerProtcol();

import "@electron/deeplink";
import "@electron/instance";
import "@electron/ipc";
import "@electron/log";
import "@electron/updater";

import { setupCollections } from "@electron/db";
import { checkDeepLink } from "@electron/deeplink";
import { runMigrations } from "@electron/migrate";
import { initializeStartup } from "@electron/startup";
import { createTray } from "@electron/tray";
import { initVaults, stopAllVaults } from "@electron/vault/manage";
import { createWindow, onAllWindowsClosed } from "@electron/window";

app.on("ready", async () => {
  await runMigrations();
  await setupCollections();

  void initializeStartup();
  listenProtocol();
  createTray();
  initVaults();

  if (!process.argv.includes("--hidden")) createWindow();

  // Deeplinks might send messages to the window
  // so it should be called after createWindow
  checkDeepLink();
});

app.on("will-quit", () => {
  stopAllVaults();
});

app.on("window-all-closed", onAllWindowsClosed);
