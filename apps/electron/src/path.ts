import { isAbsolute, join, resolve } from "node:path";
import { APP_SLUG } from "@blinkdisk/constants/app";
import { coreBuildTarget } from "@blinkdisk/constants/core";
import { app } from "electron";

export const platform = (() => {
  switch (process.platform) {
    case "win32":
      return "win";
    case "darwin":
      return "mac";
    case "linux":
      return "linux";
    default:
      return "win";
  }
})();

export function globalConfigDirectory() {
  const override = process.env.DISKPOND_DATA_DIR;
  if (!app.isPackaged && override) {
    if (!isAbsolute(override))
      throw new Error("DISKPOND_DATA_DIR must be absolute");
    return override;
  }
  return join(
    app.getPath("appData"),
    app.isPackaged ? APP_SLUG : `${APP_SLUG}-dev`,
  );
}

export const globalVaultDirectory = () =>
  join(globalConfigDirectory(), "vaults");

export const globalAccountDirectory = () =>
  join(globalConfigDirectory(), "accounts");

export const corePath = () => {
  if (!app.isPackaged) {
    const target = coreBuildTarget(process.platform, process.arch);
    return resolve(
      import.meta.dirname,
      "../../core/dist",
      target.directory,
      target.executable,
    );
  }

  return (
    {
      mac: join(process.resourcesPath, "binaries", "kopia"),
      win: join(process.resourcesPath, "binaries", "kopia.exe"),
      linux: join(process.resourcesPath, "binaries", "kopia"),
    } as const
  )[platform];
};
