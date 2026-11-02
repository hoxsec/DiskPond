import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export function assertNoCredentials(bytes, secrets, label) {
  for (const secret of secrets)
    for (const value of [
      Buffer.from(secret),
      Buffer.from(secret, "utf16le"),
      Buffer.from(Buffer.from(secret).toString("base64")),
    ])
      assert.ok(!bytes.includes(value), `Credential found in ${label}`);
}

// Chromium/engine caches can hold exclusive Windows handles while running.
// Defer those files during live scans, then require the complete post-exit scan.
export async function scanCredentials(path, secrets, live = false) {
  let deferred = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory())
      deferred += await scanCredentials(file, secrets, live);
    else {
      assert.ok(
        !/\.(kopia|blinkdisk)-password$/.test(entry.name),
        "Engine password file found",
      );
      for (let attempt = 0; ; attempt++) {
        try {
          assertNoCredentials(await readFile(file), secrets, entry.name);
          break;
        } catch (error) {
          if (error.code === "ENOENT") break;
          if (error.code !== "EBUSY") throw error;
          if (live) {
            deferred++;
            break;
          }
          if (attempt >= 20)
            throw new Error(
              `Post-exit credential scan remains blocked: ${entry.name}`,
            );
          await delay(100);
        }
      }
    }
  }
  return deferred;
}
