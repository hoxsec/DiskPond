import { join } from "node:path";
import {
  APP_NAME,
  INTERNAL_PROTOCOL,
  PROTOCOL_FRONTEND_URL,
} from "@diskpond/constants/app";
import { openBrowser } from "@electron/shell";
import { store } from "@electron/store";
import { getTheme } from "@electron/theme";
import { app, BrowserWindow } from "electron";

export let window: BrowserWindow | null = null;

export function onAllWindowsClosed() {
  if (store.get("preferences.keepRunningInBackground") === false) app.quit();
}

export function createWindow() {
  window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: getTheme() === "light" ? "#f6f7f9" : "#121418",
    icon: app.isPackaged
      ? join(process.resourcesPath, "assets", "icon.png")
      : join(import.meta.dirname, "..", "icon", "icon.png"),
    webPreferences: {
      preload: join(import.meta.dirname, "preload.js"),
    },
  });

  if (!app.isPackaged && process.env.DISKPOND_PREVIEW !== "1") {
    window.webContents.openDevTools();
  }

  window.setMenu(null);

  window.loadURL(
    app.isPackaged || process.env.DISKPOND_PREVIEW === "1"
      ? PROTOCOL_FRONTEND_URL
      : process.env.DESKTOP_URL || "http://127.0.0.1:3002",
  );

  window.webContents.setWindowOpenHandler(({ url: rawUrl }) => {
    const url = new URL(rawUrl);

    if (
      url.protocol === INTERNAL_PROTOCOL ||
      (!app.isPackaged &&
        process.env.DESKTOP_URL &&
        url.origin === new URL(process.env.DESKTOP_URL).origin)
    )
      window?.loadURL(rawUrl);
    else if (
      url.protocol === "https:" ||
      url.protocol === "http:" ||
      url.protocol === "mailto:"
    )
      openBrowser(rawUrl);

    return { action: "deny" };
  });

  return window;
}

export function focusWindow() {
  if (!window || window.isDestroyed()) window = createWindow();
  if (!window.isVisible()) window.show();
  if (window.isMinimized()) window.restore();
  window.focus();
}

export function sendWindow(channel: string, payload?: object) {
  if (!window || window.isDestroyed()) return false;

  window.webContents.send(channel, payload);
  return true;
}

export function setProgressBar(progress: number) {
  if (!window || window.isDestroyed()) return;

  window.setProgressBar(progress);
}
