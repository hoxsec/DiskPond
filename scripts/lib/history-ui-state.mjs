import { useParams } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

const date = new Date();
date.setHours(10, 0, 0, 0);
export const time = date.toISOString();
export const summary = {
  size: 8,
  files: 2,
  symlinks: 0,
  dirs: 1,
  maxTime: time,
  numFailed: 0,
};
const source = (name, user, path) => ({
  id: `${user}@archive-pc:${path}`,
  name,
  type: "directory",
  source: { host: "archive-pc", userName: user, path },
  status: "REMOTE",
  schedule: { runMissed: false },
  currentTask: "",
  currentTaskStatus: "SUCCESS",
});
export const sources = [
  source("Documents", "sam", "D:\\Documents"),
  { ...source("Single file", "alex", "D:\\single.txt"), type: "file" },
  {
    ...source(
      `Partial folder — ${"long-name-雪-".repeat(12)}`,
      "sam",
      "D:\\Partial",
    ),
    lastBackupOutcome: {
      id: "known-failure",
      status: "FAILED",
      startTime: time,
      endTime: time,
      errorMessage: "Fixture storage unavailable",
      errorCount: 1,
    },
  },
];
export const snapshots = [0, 1, 2].map((index) => ({
  id: `snapshot-${index}`,
  description: `Backup ${index}`,
  startTime: new Date(date.getTime() + index * 60_000).toISOString(),
  endTime: new Date(date.getTime() + index * 60_000 + 30_000).toISOString(),
  rootID: index ? "root-b" : "root-a",
  rootEntryType: "d",
  summary,
  retention: [],
  pins: [],
}));
export let fixtureVaults = [
  { id: "vault-a", name: "Fixture A", provider: "INTERNAL_DRIVE" },
  { id: "vault-b", name: "Fixture B", provider: "INTERNAL_DRIVE" },
];
const vaultListeners = new Set();
export function setFixtureVaults(vaults) {
  fixtureVaults = vaults;
  for (const listener of vaultListeners) listener();
}
const subscribeVaults = (listener) => {
  vaultListeners.add(listener);
  return () => vaultListeners.delete(listener);
};
const unexpected = () => {
  throw new Error("History inspection must not mutate backup data");
};
export function useVaultList() {
  return { data: useSyncExternalStore(subscribeVaults, () => fixtureVaults) };
}
export function useLocalProfile() {
  return { localHostName: "laptop", localUserName: "owner", remote: true };
}
export function useSourceList(options = {}) {
  return {
    data: options.unfiltered
      ? sources
      : sources.filter(
          (item) =>
            item.source.host === options.profile?.deviceName &&
            item.source.userName === options.profile?.userName,
        ),
  };
}
export function useVaultDevices() {
  return {
    data: [
      {
        hostName: "archive-pc",
        users: [{ userName: "sam" }, { userName: "alex" }],
      },
    ],
  };
}
export function useBackupList() {
  return { data: snapshots };
}
export function useCompletedBackupList() {
  return { data: snapshots };
}
export function useBackup() {
  const { backupId } = useParams({ strict: false });
  return { data: snapshots.find((item) => item.id === backupId) };
}
export function useMount() {
  return { data: null };
}
export function usePlatform() {
  return { data: "windows" };
}
export function useSource() {
  const { sourceId } = useParams({ strict: false });
  return { data: sources.find((item) => item.id === sourceId) };
}
export function useRestoreList() {
  return { data: [], isError: false, refetch: async () => {} };
}
export function useBackupStartFeedback() {
  return { startBackup: unexpected, isStartingBackup: false };
}
export function useCancelBackup() {
  return { mutate: unexpected, isPending: false };
}
export function useStartRestore() {
  return { mutate: unexpected, isPending: false };
}
export function useStartMount() {
  return { mutate: unexpected, isPending: false };
}
export function useStopMount() {
  return { mutate: unexpected, isPending: false };
}
export function useCreateSourceDialog() {
  return { openCreateSource: unexpected };
}
export function useCreateVaultDialog() {
  return { openCreateVault: unexpected, openConnectVault: unexpected };
}
export function useDeleteSourceDialog() {
  return { openDeleteSourceDialog: unexpected };
}
export function useTaskDialog() {
  return { openTaskDialog: unexpected };
}
export function useDeleteBackupDialog() {
  return { openDeleteBackupDialog: unexpected };
}
export function usePinBackupDialog() {
  return { openPinBackupDialog: unexpected };
}
export function useRenameBackupDialog() {
  return { openRenameBackupDialog: unexpected };
}
export function useRestoreDirectoryDialog() {
  return { openRestoreDirectory: unexpected };
}
function subscribeTheme(listener) {
  const observer = new MutationObserver(listener);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
export function useTheme() {
  return {
    dark: useSyncExternalStore(subscribeTheme, () =>
      document.body.classList.contains("dark"),
    ),
  };
}
