import {
  RELEASE_OWNER,
  RELEASE_REPOSITORY,
  SOURCE_URL,
} from "@diskpond/constants/app";
import { updateMetadataName } from "@diskpond/constants/update";
import { log } from "@electron/log";
import { store } from "@electron/store";
import {
  getUpdateActivity,
  type UpdateActivity,
} from "@electron/update-activity";
import {
  newUpdateAttempt,
  readUpdateState,
  reconcileUpdateHistory,
  saveUpdateState,
  type UpdateHistoryEntry,
  type UpdateOutcome,
} from "@electron/update-history";
import { sendWindow } from "@electron/window";
import { app, shell } from "electron";
import electronUpdater from "electron-updater";
import { compare, gt, prerelease, valid } from "semver";
import { parse } from "yaml";
import { z } from "zod";

const { autoUpdater } = electronUpdater;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowDowngrade = false;
// Keep updater errors out of logs containing download URLs or local paths.
autoUpdater.logger = null;
autoUpdater.on("error", () => {
  if (status.phase === "installing") {
    recordOutcome("INSTALL_FAILED");
    publishStatus({ phase: "ready", installFailed: true });
    void refreshActivity();
  }
});

const stored = readUpdateState();
let local = app.isPackaged
  ? reconcileUpdateHistory(stored, app.getVersion())
  : stored;
let historyUnavailable = false;
try {
  if (JSON.stringify(local) !== JSON.stringify(stored)) saveUpdateState(local);
} catch {
  historyUnavailable = true;
  log.warn("Unable to save DiskPond update history");
}

export type UpdateStatus = {
  available: boolean;
  version: string | null;
  currentVersion: string;
  history: UpdateHistoryEntry[];
  historyUnavailable?: boolean;
  manual?: boolean;
  notes?: string;
  remindUntil?: number;
  phase?:
    | "downloading"
    | "canceling"
    | "canceled"
    | "ready"
    | "installing"
    | "error";
  progress?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  activity?: UpdateActivity;
  installFailed?: boolean;
};
let status: UpdateStatus = {
  available: false,
  version: null,
  currentVersion: app.getVersion(),
  history: local.history,
  historyUnavailable,
  // Squirrel.Mac requires Developer ID signing. DEB/RPM updates use the user's
  // package manager; only AppImage supports our Linux in-app replacement path.
  manual:
    process.platform === "darwin" ||
    (process.platform === "linux" && !process.env.APPIMAGE),
};
let pending: Promise<UpdateStatus> | undefined;
let download: Promise<void> | undefined;
let installation: Promise<void> | undefined;
let releaseTag: string | undefined;
let attemptId: string | undefined;
let cancelRequested = false;
let shuttingDown = false;
let cancellation: { cancel: () => void } | undefined;
let reminderTimer: ReturnType<typeof setTimeout> | undefined;
let activityTimer: ReturnType<typeof setTimeout> | undefined;

function recordOutcome(outcome: UpdateOutcome) {
  const next = {
    ...local,
    history: local.history.map((item) =>
      item.id === attemptId
        ? { ...item, outcome, updatedAt: new Date().toISOString() }
        : item,
    ),
  };
  local = next;
  try {
    saveUpdateState(next);
    historyUnavailable = false;
    return true;
  } catch {
    historyUnavailable = true;
    log.warn("Unable to save DiskPond update history");
    return false;
  }
}

function publishStatus(next: Partial<UpdateStatus>) {
  status = { ...status, ...next, history: local.history, historyUnavailable };
  status.remindUntil =
    local.reminder?.version === status.version &&
    local.reminder.until > Date.now()
      ? local.reminder.until
      : undefined;
  sendWindow("update.available", status);
}

function scheduleReminder() {
  clearTimeout(reminderTimer);
  if (!local.reminder || local.reminder.until <= Date.now()) return;
  reminderTimer = setTimeout(
    () => publishStatus({}),
    local.reminder.until - Date.now(),
  );
  reminderTimer.unref();
}

export function remindUpdateLater() {
  if (
    !status.available ||
    !status.version ||
    download ||
    status.phase === "installing"
  )
    throw new Error("Cannot postpone this update");
  const next = {
    ...local,
    reminder: {
      version: status.version,
      until: Date.now() + 24 * 60 * 60 * 1000,
    },
  };
  saveUpdateState(next);
  local = next;
  publishStatus({});
  scheduleReminder();
}

function clearReminder() {
  if (!local.reminder) return;
  const next = { ...local, reminder: null };
  saveUpdateState(next);
  local = next;
  clearTimeout(reminderTimer);
  publishStatus({});
}

async function refreshActivity() {
  if (status.phase !== "ready") return;
  const activity = await getUpdateActivity();
  if (status.phase !== "ready") return;
  publishStatus({ activity });
  clearTimeout(activityTimer);
  activityTimer = setTimeout(() => void refreshActivity(), 5000);
  activityTimer.unref();
}

autoUpdater.on(
  "download-progress",
  ({ percent, transferred, total, bytesPerSecond }) => {
    const number = (value: number) =>
      Number.isFinite(value) && value >= 0 ? value : undefined;
    if (status.phase === "downloading")
      publishStatus({
        progress:
          number(percent) === undefined ? undefined : Math.min(100, percent),
        transferred: number(transferred),
        total: number(total),
        bytesPerSecond: number(bytesPerSecond),
      });
  },
);

app.once("before-quit", () => {
  shuttingDown = true;
  clearTimeout(reminderTimer);
  clearTimeout(activityTimer);
  cancellation?.cancel();
});
scheduleReminder();

const releasesSchema = z.array(
  z.object({
    tag_name: z.string(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    body: z.string().nullable().optional(),
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
      return [
        {
          tag: release.tag_name,
          version,
          notes: (release.body ?? "").slice(0, 32_000),
        },
      ];
    })
    .sort((a, b) => compare(b.version, a.version));
  const latest = candidates[0];
  if (!latest) throw new Error("No published release found");
  const metadata = z
    .object({ version: z.string() })
    .parse(
      parse(
        await readResponse(
          `${SOURCE_URL}/releases/download/${encodeURIComponent(latest.tag)}/${updateMetadataName(process.platform, process.arch)}`,
          signal,
          64_000,
        ),
        { maxAliasCount: 0 },
      ),
    );
  const version = valid(metadata.version);
  if (!version || version !== latest.version)
    throw new Error("Invalid update metadata");
  releaseTag = latest.tag;
  publishStatus({
    available: gt(version, current),
    version,
    notes: latest.notes,
    phase: undefined,
    installFailed: false,
  });
  return status;
}

export function checkForUpdates(): Promise<UpdateStatus> {
  clearReminder();
  return checkUpdates();
}

function checkUpdates(): Promise<UpdateStatus> {
  if (download || status.phase === "ready" || status.phase === "installing")
    return Promise.resolve(status);
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
    void checkUpdates().catch(() => {});
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

export function downloadUpdate(): Promise<void> {
  if (download) return download;
  if (status.phase === "ready") return Promise.resolve();
  if (status.phase === "installing")
    return Promise.reject(new Error("Update is installing"));
  if (!app.isPackaged)
    return Promise.reject(new Error("Updates require an installed app"));
  if (!status.available || !releaseTag || pending)
    return Promise.reject(new Error("No update available"));
  const version = status.version;
  if (!version) return Promise.reject(new Error("No update available"));
  clearReminder();
  if (status.manual)
    return shell.openExternal(
      `${SOURCE_URL}/releases/tag/${encodeURIComponent(releaseTag)}`,
    );
  const attempt = newUpdateAttempt(version, app.getVersion());
  const next = { ...local, history: [attempt, ...local.history].slice(0, 50) };
  saveUpdateState(next);
  local = next;
  attemptId = attempt.id;
  cancelRequested = false;
  autoUpdater.setFeedURL({
    provider: "generic",
    url: `${SOURCE_URL}/releases/download/${encodeURIComponent(releaseTag)}/`,
  });
  autoUpdater.allowPrerelease = prerelease(app.getVersion()) !== null;
  publishStatus({
    available: true,
    version,
    phase: "downloading",
    progress: 0,
    transferred: undefined,
    total: undefined,
    bytesPerSecond: undefined,
    installFailed: false,
  });
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      cancellation?.cancel();
    },
    15 * 60 * 1000,
  );
  download = (async () => {
    const result = await autoUpdater.checkForUpdates();
    if (
      !result ||
      result.updateInfo.version !== version ||
      !result.cancellationToken
    )
      throw new Error("Update metadata changed");
    const cancellationToken = result.cancellationToken;
    cancellation = cancellationToken;
    if (cancelRequested || timedOut) {
      cancellation.cancel();
      throw new Error("Download stopped");
    }
    // electron-updater verifies the download against the platform metadata.
    await autoUpdater.downloadUpdate(cancellationToken);
    if (cancelRequested || timedOut) throw new Error("Download stopped");
    recordOutcome("DOWNLOADED");
    publishStatus({ phase: "ready", activity: undefined });
    void refreshActivity();
  })()
    .catch(() => {
      recordOutcome(
        shuttingDown
          ? "INTERRUPTED"
          : cancelRequested
            ? "CANCELED"
            : "DOWNLOAD_FAILED",
      );
      publishStatus({
        phase: cancelRequested ? "canceled" : "error",
        progress: undefined,
        transferred: undefined,
        total: undefined,
        bytesPerSecond: undefined,
      });
      if (cancelRequested || shuttingDown) return;
      throw new Error("Unable to download update");
    })
    .finally(() => {
      clearTimeout(timer);
      cancellation = undefined;
      download = undefined;
    });
  return download;
}

export function cancelUpdateDownload() {
  if (!download || status.phase !== "downloading") return;
  cancelRequested = true;
  publishStatus({ phase: "canceling" });
  cancellation?.cancel();
}

export function installUpdate(): Promise<void> {
  if (installation) return installation;
  if (!app.isPackaged || status.phase !== "ready")
    return Promise.reject(new Error("Update is not ready to install"));
  installation = (async () => {
    const activity = await getUpdateActivity();
    publishStatus({ activity });
    if (activity !== "idle") return;
    clearTimeout(activityTimer);
    if (!recordOutcome("INSTALLING")) {
      recordOutcome("INSTALL_FAILED");
      publishStatus({ installFailed: true });
      void refreshActivity();
      return;
    }
    publishStatus({ phase: "installing", installFailed: false });
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch {
      recordOutcome("INSTALL_FAILED");
      publishStatus({ phase: "ready", installFailed: true });
      void refreshActivity();
      throw new Error("Unable to install update");
    }
  })().finally(() => {
    installation = undefined;
  });
  return installation;
}

export function getUpdateStatus() {
  return status;
}
