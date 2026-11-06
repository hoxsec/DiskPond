import { LANGUAGE_CODES } from "@diskpond/constants/language";
import { ZTheme } from "@schemas/shared/theme";
import { z } from "zod";

export const ZInterfaceScale = z.enum([
  "0.75",
  "0.9",
  "1",
  "1.1",
  "1.25",
  "1.5",
  "1.75",
  "2",
]);

export const ZUpdatePreferences = z.object({
  theme: ZTheme,
  language: z.enum(LANGUAGE_CODES),
  checkForUpdates: z.boolean(),
  launchAtLogin: z.boolean(),
  keepRunningInBackground: z.boolean(),
  interfaceScale: ZInterfaceScale,
  reduceMotion: z.boolean(),
  mode: z.enum(["basic", "advanced"]),
});

export type ZUpdatePreferencesType = z.infer<typeof ZUpdatePreferences>;
