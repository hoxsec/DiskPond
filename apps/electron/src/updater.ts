import {
  RELEASE_OWNER,
  RELEASE_REPOSITORY,
  SOURCE_URL,
} from "@blinkdisk/constants/app";
import { log } from "@electron/log";
import { store } from "@electron/store";
import { sendWindow } from "@electron/window";
import { app, shell } from "electron";
import { compare, gt, prerelease, valid } from "semver";
import { parse } from "yaml";
import { z } from "zod";

export type UpdateStatus = { available: boolean; version: string | null };
let status: UpdateStatus = { available: false, version: null };
let pending: Promise<UpdateStatus> | undefined;

const releasesSchema = z.array(
  z.object({
    tag_name: z.string(),
    draft: z.boolean(),
    prerelease: z.boolean(),
  }),
);

async function readResponse(url: string, signal: AbortSignal, limit: number) {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "DiskPond",
    },
  });
  if (!response.ok || !response.body) throw new Error("Update request failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > limit) throw new Error("Update response too large");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

async function discoverUpdate(): Promise<UpdateStatus> {
  const current = valid(app.getVersion());
  if (!current) throw new Error("Invalid application version");
  const signal = AbortSignal.timeout(15_000);
  const releases = releasesSchema.parse(
    JSON.parse(
      await readResponse(
        `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPOSITORY}/releases?per_page=100`,
        signal,
        1_000_000,
      ),
    ),
  );
  const includePrereleases = !app.isPackaged || prerelease(current) !== null;
  const candidates = releases
    .flatMap((release) => {
      const version = valid(release.tag_name);
      if (
        !version ||
        release.draft ||
        (!includePrereleases && (release.prerelease || prerelease(version)))
      )
        return [];
      return [{ tag: release.tag_name, version }];
    })
    .sort((a, b) => compare(b.version, a.version));
  const latest = candidates[0];
  if (!latest) throw new Error("No published release found");
  const metadata = z
    .object({ version: z.string() })
    .parse(
      parse(
        await readResponse(
          `${SOURCE_URL}/releases/download/${encodeURIComponent(latest.tag)}/latest.yml`,
          signal,
          64_000,
        ),
        { maxAliasCount: 0 },
      ),
    );
  const version = valid(metadata.version);
  if (!version || version !== latest.version)
    throw new Error("Invalid update metadata");
  status = { available: gt(version, current), version };
  sendWindow("update.available", status);
  return status;
}

export function checkForUpdates(): Promise<UpdateStatus> {
  if (!pending) {
    pending = discoverUpdate()
      .catch(() => {
        log.warn("Unable to check for DiskPond updates");
        throw new Error("Unable to check for updates");
      })
      .finally(() => {
        pending = undefined;
      });
  }
  return pending;
}

if (app.isPackaged) {
  const check = () => {
    if (store.get("preferences.checkForUpdates") === false) return;
    void checkForUpdates().catch(() => {});
  };
  void app.whenReady().then(() => {
    check();
    store.onDidChange("preferences.checkForUpdates", (enabled) => {
      if (enabled !== false) check();
    });
    const timer = setInterval(check, 60 * 60 * 1000);
    timer.unref();
    app.once("before-quit", () => clearInterval(timer));
  });
}

export function openUpdateReleases() {
  return shell.openExternal(`${SOURCE_URL}/releases`);
}

export function getUpdateStatus() {
  return status;
}
