import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { root } from "./lib/process.mjs";

const destination = resolve(root, "apps/electron/frontend");
await rm(destination, { recursive: true, force: true });
await cp(resolve(root, "apps/desktop/dist"), destination, { recursive: true });
