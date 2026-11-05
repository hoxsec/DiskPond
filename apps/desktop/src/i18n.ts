import {
  LANGUAGE_CODES,
  type LanguageCode,
} from "@blinkdisk/constants/language";
import { DESKTOP_NAMESPACES } from "@blinkdisk/constants/localization";
import { i18n } from "@blinkdisk/utils/i18n";

i18n.loadNamespaces(DESKTOP_NAMESPACES);

const language = window.electron.store.get("preferences.language");
if (LANGUAGE_CODES.includes(language as LanguageCode))
  void i18n.changeLanguage(language as LanguageCode);

export { i18n };
