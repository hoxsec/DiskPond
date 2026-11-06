import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CODES,
} from "@diskpond/constants/language";
import i18n from "i18next";
import detector from "i18next-browser-languagedetector";
import backend from "i18next-http-backend";
import {
  I18nextProvider,
  initReactI18next,
  Trans,
  useTranslation,
} from "react-i18next";

i18n
  .use(detector)
  .use(backend)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE_CODE,
    supportedLngs: LANGUAGE_CODES,
    load: "languageOnly",
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on("languageChanged", (language) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
    document.documentElement.dir = i18n.dir(language);
  }
});

export { I18nextProvider, i18n, Trans, useTranslation };
