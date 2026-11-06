import { join } from "node:path";
import { APP_NAME } from "@diskpond/constants/app";
import type { LanguageCode } from "@diskpond/constants/language";
import { platform } from "@electron/path";
import { store } from "@electron/store";
import { focusWindow } from "@electron/window";
import { app, Menu, nativeImage, Tray } from "electron";
import de from "../../../locales/de/translation.json";
import en from "../../../locales/en/translation.json";
import es from "../../../locales/es/translation.json";
import fr from "../../../locales/fr/translation.json";
import it from "../../../locales/it/translation.json";
import nl from "../../../locales/nl/translation.json";
import pl from "../../../locales/pl/translation.json";
import tr from "../../../locales/tr/translation.json";

let tray: Tray | null = null;
const messages = { en, es, fr, de, tr, nl, it, pl } satisfies Record<
  LanguageCode,
  typeof en
>;

function updateTrayMenu() {
  const language = [
    store.get("preferences.language"),
    ...app.getPreferredSystemLanguages(),
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase().split(/[-_]/)[0])
    .find((value) => value && Object.hasOwn(messages, value));
  const { tray: labels } = messages[language as keyof typeof messages] ?? en;

  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: labels.open, type: "normal", click: () => focusWindow() },
      { label: labels.quit, type: "normal", click: () => app.quit() },
    ]),
  );
}

export function createTray() {
  const iconsPath = !app.isPackaged
    ? join(import.meta.dirname, "..", "assets", "tray")
    : join(process.resourcesPath, "assets", "tray");

  const fileName =
    platform === "mac"
      ? "mac-Template.png"
      : platform === "win"
        ? "win.ico"
        : "linux.png";

  const trayIcon = nativeImage.createFromPath(join(iconsPath, fileName));

  tray = new Tray(trayIcon);

  tray.setToolTip(APP_NAME);
  updateTrayMenu();
  store.onDidChange("preferences.language", updateTrayMenu);

  tray.on("click", () => focusWindow());
  tray.on("double-click", () => focusWindow());
  tray.on("right-click", () => tray?.popUpContextMenu());
}
