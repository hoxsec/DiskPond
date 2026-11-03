import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { VaultRestores } from "../../apps/desktop/src/components/vaults/restores.tsx";
import { i18n } from "../../libs/utils/src/i18n.ts";
import directory from "../../locales/en/directory.json";

await i18n.init({
  lng: "en",
  fallbackLng: "en",
  ns: ["directory"],
  defaultNS: "directory",
  resources: { en: { directory } },
  interpolation: { escapeValue: false },
});
createRoot(document.getElementById("root")).render(
  createElement(VaultRestores),
);
