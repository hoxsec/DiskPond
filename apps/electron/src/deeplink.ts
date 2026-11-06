import { APP_SCHEME, APP_SCHEME_PROTOCOL } from "@diskpond/constants/app";
import { focusWindow, sendWindow } from "@electron/window";
import { app } from "electron";

// Development and preview launches must not replace an installed URI handler.
if (app.isPackaged && !app.setAsDefaultProtocolClient(APP_SCHEME))
  console.warn(`Failed to register ${APP_SCHEME} as default protocol client`);

export async function onDeeplinkOpen(rawUrl: string) {
  let url: URL | null = null;
  try {
    url = new URL(rawUrl);
  } catch {
    // Not a url, ignore
  }

  if (!url) return;

  if (url.protocol !== APP_SCHEME_PROTOCOL) return;
  if (url.host !== "settings") return;

  sendWindow("deeplink.onOpen", {
    event: url.host,
  });
}

app.on("open-url", (_, url) => {
  focusWindow();

  // This event should only be triggered on MacOS
  if (process?.platform !== "darwin") return;

  onDeeplinkOpen(url);
});

export function checkDeepLink() {
  if (process?.platform === "darwin" || typeof process.argv[1] !== "string")
    return;

  let url: string | null = null;
  try {
    url = new URL(process.argv[1]).toString();
  } catch {
    // Not a url, ignore
  }

  if (!url) return;
  onDeeplinkOpen(url);
}
