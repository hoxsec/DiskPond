export const LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "de",
  "tr",
  "nl",
  "it",
  "pl",
] as const;
export const DEFAULT_LANGUAGE_CODE = "en";

export const LANGUAGE_NAMES = {
  en: {
    name: "English",
  },
  es: {
    name: "Español",
  },
  fr: {
    name: "Français",
  },
  de: {
    name: "Deutsch",
  },
  tr: {
    name: "Türkçe",
  },
  nl: {
    name: "Nederlands",
  },
  it: {
    name: "Italiano",
  },
  pl: {
    name: "Polski",
  },
};

export type LanguageCode = (typeof LANGUAGE_CODES)[number];
