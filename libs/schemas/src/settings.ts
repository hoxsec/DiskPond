import { ZAccountLanguage } from "@schemas/accounts";
import { ZTheme } from "@schemas/shared/theme";
import { z } from "zod";

export const ZUpdatePreferences = z.object({
  theme: ZTheme,
  language: ZAccountLanguage,
  checkForUpdates: z.boolean(),
});

export type ZUpdatePreferencesType = z.infer<typeof ZUpdatePreferences>;
