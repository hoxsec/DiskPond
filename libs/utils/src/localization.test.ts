import { readFileSync } from "node:fs";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CODES,
} from "@blinkdisk/constants/language";
import { DESKTOP_NAMESPACES } from "@blinkdisk/constants/localization";
import { createInstance } from "i18next";

function readLocale(language: string, namespace: string) {
  return JSON.parse(
    readFileSync(
      new URL(
        `../../../locales/${language}/${namespace}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
}

function leaves(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  if (!value || typeof value !== "object")
    throw new Error(`Invalid translation at ${path}`);
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      Object.entries(leaves(child, path ? `${path}.${key}` : key)),
    ),
  );
}

const resources = Object.fromEntries(
  LANGUAGE_CODES.map((language) => [
    language,
    Object.fromEntries(
      DESKTOP_NAMESPACES.map((namespace) => [
        namespace,
        readLocale(language, namespace),
      ]),
    ),
  ]),
);

describe.each(LANGUAGE_CODES)("%s desktop translations", (language) => {
  it.each(
    DESKTOP_NAMESPACES,
  )("%s covers English keys, plural categories, interpolation and markup", (namespace) => {
    const source = leaves(resources.en?.[namespace]);
    const translated = leaves(resources[language]?.[namespace]);
    const expected = { ...source };
    for (const [key, value] of Object.entries(source).filter(([key]) =>
      key.endsWith("_other"),
    ))
      for (const category of new Intl.PluralRules(language).resolvedOptions()
        .pluralCategories)
        expected[key.replace(/_other$/, `_${category}`)] ??= value;

    expect(Object.keys(translated).sort()).toEqual(
      Object.keys(expected).sort(),
    );
    for (const [key, original] of Object.entries(expected)) {
      const text = translated[key];
      expect(text, key).toBeTypeOf("string");
      if (typeof text !== "string") throw new Error(`Missing ${key}`);
      // Cron sentence fragments may intentionally be empty in other languages.
      if (!key.startsWith("component.")) expect(text.trim(), key).not.toBe("");
      for (const pattern of [/{{[^}]+}}/g, /<\/?\d+>/g])
        expect(text.match(pattern)?.sort() ?? [], key).toEqual(
          original.match(pattern)?.sort() ?? [],
        );
    }
  });

  it("provides cron month and weekday arrays", () => {
    const cron = readLocale(language, "cron").component;
    expect(Array.isArray(cron.weekDays)).toBe(true);
    expect(cron.weekDays).toHaveLength(7);
    expect(cron.altWeekDays).toHaveLength(7);
    expect(Array.isArray(cron.months)).toBe(true);
    expect(cron.months).toHaveLength(12);
    expect(cron.altMonths).toHaveLength(12);
  });

  it("resolves plural translations without falling back to English", async () => {
    const i18n = createInstance();
    await i18n.init({
      resources,
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE_CODE,
      ns: DESKTOP_NAMESPACES,
    });
    for (const namespace of DESKTOP_NAMESPACES) {
      const keys = Object.keys(leaves(resources.en?.[namespace])).filter(
        (key) => key.endsWith("_other"),
      );
      for (const key of keys)
        for (const count of [0, 1, 2, 5, 12, 22, 1.5, 1_000_000]) {
          const result = i18n.t(`${namespace}:${key.replace(/_other$/, "")}`, {
            count,
            returnDetails: true,
          });
          expect(result.usedLng, `${namespace}:${key}, count=${count}`).toBe(
            language,
          );
        }
    }
  });
});

it.each([
  ["es-MX", "es"],
  ["fr-CA", "fr"],
  ["de-AT", "de"],
  ["en-GB", "en"],
  ["tr-TR", "tr"],
  ["nl-BE", "nl"],
  ["it-CH", "it"],
  ["pl-PL", "pl"],
  ["ja-JP", "en"],
])("resolves %s to bundled %s resources", async (requested, expected) => {
  const i18n = createInstance();
  await i18n.init({
    resources,
    lng: requested,
    supportedLngs: LANGUAGE_CODES,
    load: "languageOnly",
    fallbackLng: DEFAULT_LANGUAGE_CODE,
    ns: DESKTOP_NAMESPACES,
  });
  expect(i18n.resolvedLanguage).toBe(expected);
  expect(i18n.t("settings:account.preferences.language.label")).toBe(
    readLocale(expected, "settings").account.preferences.language.label,
  );
});
