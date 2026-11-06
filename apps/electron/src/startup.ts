import { APP_NAME } from "@diskpond/constants/app";
import AutoLaunch from "auto-launch";
import { app } from "electron";

if (app.isPackaged) {
  const autoLauncher = new AutoLaunch({
    name: APP_NAME,
    isHidden: true,
    mac: {
      useLaunchAgent: true,
    },
  });

  autoLauncher.enable();
}
