import { i18n } from "@blinkdisk/utils/i18n";

i18n.loadNamespaces([
  "error",
  "workspace",
  "settings",
  "validation",
  "sidebar",
  "vault",
  "folder",
  "cron",
  "policy",
  "directory",
  "backup",
  "update",
  "task",
]);

const language = window.electron.store.get("preferences.language");
if (typeof language === "string") void i18n.changeLanguage(language);

export { i18n };
