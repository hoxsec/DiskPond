import { APP_NAME } from "@diskpond/constants/app";
import { store } from "@electron/store";
import AutoLaunch from "auto-launch";
import { app } from "electron";

let pending = Promise.resolve();

export function setLaunchAtLogin(enabled: boolean): Promise<void> {
  if (!app.isPackaged)
    return Promise.reject(
      new Error("Launch at sign-in is only available in installed builds."),
    );

  // Serialize changes so a startup registration cannot race a user's opt-out.
  const request = pending.then(async () => {
    const autoLauncher = new AutoLaunch({
      name: APP_NAME,
      isHidden: true,
      ...(process.platform === "linux" && process.env.APPIMAGE
        ? { path: process.env.APPIMAGE }
        : {}),
      mac: { useLaunchAgent: true },
    });

    if (enabled) await autoLauncher.enable();
    else await autoLauncher.disable();

    // Only report the preference as saved after the OS operation succeeds.
    store.set("preferences.launchAtLogin", enabled);
  });
  pending = request.catch(() => {});
  return request;
}

export async function initializeStartup() {
  if (!app.isPackaged) return;
  try {
    await setLaunchAtLogin(store.get("preferences.launchAtLogin") !== false);
  } catch (error) {
    console.error("Unable to configure launch at sign-in", error);
  }
}
