import { useAppStorage } from "@desktop/hooks/use-app-storage";
import { useMediaQuery } from "@diskpond/hooks/use-media-query";
import { useMemo } from "react";

export function useTheme() {
  const [theme, setTheme] = useAppStorage("preferences.theme", "system");
  const media = useMediaQuery("(prefers-color-scheme: dark)");

  const shownTheme = useMemo(() => {
    if (theme !== "system") return theme;
    return media ? "dark" : "light";
  }, [theme, media]);

  return {
    dark: shownTheme === "dark",
    light: shownTheme === "light",
    shownTheme,
    theme,
    setTheme,
  };
}
