import { LANGUAGE_CODES } from "@diskpond/constants/language";
import { ZTheme } from "@schemas/shared/theme";
import { z } from "zod";

export const ZUpdatePreferences = z.object({
  theme: ZTheme,
  language: z.enum(LANGUAGE_CODES),
  checkForUpdates: z.boolean(),
});

export type ZUpdatePreferencesType = z.infer<typeof ZUpdatePreferences>;
