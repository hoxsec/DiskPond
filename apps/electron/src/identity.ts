import { mkdirSync } from "node:fs";
import { APP_ID, APP_NAME } from "@blinkdisk/constants/app";
import { globalConfigDirectory } from "@electron/path";
import { app } from "electron";

app.setName(APP_NAME);
const directory = globalConfigDirectory();
mkdirSync(directory, { recursive: true });
app.setPath("userData", directory);
if (process.platform === "win32") app.setAppUserModelId(APP_ID);
