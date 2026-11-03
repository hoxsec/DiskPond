import { PROTOCOL_FRONTEND_URL } from "@blinkdisk/constants/app";
import { window } from "@electron/window";
import { app, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";

export function requireMainWindow(event: IpcMainEvent | IpcMainInvokeEvent) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame
  )
    throw new Error("Invalid desktop request");
  const url = new URL(event.senderFrame.url);
  const frontend = new URL(PROTOCOL_FRONTEND_URL);
  const dev = new URL(process.env.DESKTOP_URL || "http://127.0.0.1:3002");
  if (url.protocol === frontend.protocol && url.host === frontend.host) return;
  if (!app.isPackaged && url.origin === dev.origin) return;
  throw new Error("Invalid desktop request");
}
