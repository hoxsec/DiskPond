import { i18n } from "@blinkdisk/utils/i18n";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { AccountActivity } from "../../apps/desktop/src/components/accounts/activity";
import { AccountHome } from "../../apps/desktop/src/components/accounts/home";
import { CompactNavigation } from "../../apps/desktop/src/components/sidebar/compact-navigation";
import { VaultOverview } from "../../apps/desktop/src/components/vaults/overview";
import { Route as BrowserRoute } from "../../apps/desktop/src/routes/$accountId/$vaultId/$sourceId/$backupId/$directoryId/index";
import { Route as CompareRoute } from "../../apps/desktop/src/routes/$accountId/$vaultId/$sourceId/compare";
import { Route as HistoryRoute } from "../../apps/desktop/src/routes/$accountId/$vaultId/$sourceId/index";
import backup from "../../locales/en/backup.json";
import directory from "../../locales/en/directory.json";
import folder from "../../locales/en/folder.json";
import history from "../../locales/en/history.json";
import sidebar from "../../locales/en/sidebar.json";
import vault from "../../locales/en/vault.json";
import {
  fixtureVaults,
  snapshots,
  sources,
  summary,
  time,
} from "./history-ui-state.mjs";

// Match a fresh application launch: history is loaded only when a component
// requests its namespace, rather than being bundled eagerly by this fixture.
i18n.use({
  type: "backend",
  init() {},
  read(_language, namespace, callback) {
    queueMicrotask(() =>
      callback(null, namespace === "history" ? history : {}),
    );
  },
});
await i18n.init({
  lng: "en",
  fallbackLng: "en",
  ns: ["vault", "folder", "backup", "directory", "sidebar"],
  partialBundledLanguages: true,
  resources: { en: { vault, folder, backup, directory, sidebar } },
  interpolation: { escapeValue: false },
});
const storageSpaces = new Map([
  ["vault-a", { status: "AVAILABLE", availableBytes: 250_000_000_000 }],
  ["vault-b", { status: "UNSUPPORTED" }],
]);
window.electron = {
  vault: {
    status: async () => ({ status: "RUNNING" }),
    storageSpace: async ({ vaultId }) => {
      const space = storageSpaces.get(vaultId);
      if (space === "ERROR") throw new Error("Storage query failed");
      return space;
    },
  },
  path: { basename: async (path) => path.split(/[\\/]/).at(-1) },
  platform: async () => "windows",
};
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
let mode = "normal";
let aborted = 0;
const originalFetch = window.fetch;
const entry = (name, obj, type = "f") => ({
  name,
  obj,
  type,
  size: 4,
  mtime: time,
  mode: "0644",
  uid: 0,
  gid: 0,
  ...(type === "d" ? { summ: summary } : {}),
});
window.fetch = async (input, options) => {
  const url = new URL(input, location.href);
  if (url.hostname !== "vault") return originalFetch(input, options);
  if (options.method !== "GET") throw new Error("Unexpected modifying request");
  const vaultId = new Headers(options.headers).get("vault-id");
  if (vaultId === "vault-b") throw new Error("Fixture vault offline");
  if (url.pathname.endsWith("/sources")) return Response.json({ sources });
  if (url.pathname.endsWith("/snapshots")) {
    if (url.searchParams.get("all") !== "1")
      throw new Error("Deduplicated history requested");
    const path = url.searchParams.get("path");
    const records =
      path === sources[1].source.path
        ? snapshots.slice(0, 2).map((item) => ({
            ...item,
            id: `file-${item.id}`,
            rootID: `file-${item.id}`,
            rootEntryType: "f",
            summary: null,
          }))
        : path === sources[2].source.path
          ? [
              {
                ...snapshots[0],
                id: "partial",
                summary: {
                  ...summary,
                  numFailed: 1,
                  errors: [
                    { path: "unreadable", error: "Fixture read failure" },
                  ],
                },
              },
            ]
          : snapshots;
    return Response.json({
      snapshots: mode === "insufficient" ? records.slice(0, 1) : records,
    });
  }
  if (url.pathname.includes("/objects/")) {
    if (mode === "slow")
      await new Promise((_, reject) =>
        options.signal.addEventListener(
          "abort",
          () => {
            aborted++;
            reject(options.signal.reason);
          },
          { once: true },
        ),
      );
    if (mode === "missing") throw new Error("Missing object");
    const id = url.pathname.split("/").at(-1);
    const entries =
      id === "root-a"
        ? [
            entry("gone.txt", "gone"),
            entry("edit.txt", "old"),
            entry("same", "same"),
          ]
        : id === "root-b"
          ? [
              entry("added.txt", "added"),
              entry("edit.txt", "new"),
              entry("same", "same"),
              entry("empty", "empty", "d"),
            ]
          : [];
    if (mode === "large" && id === "root-b")
      for (let index = 0; index < 250; index++)
        entries.push(
          entry(
            `long-雪-path-${index.toString().padStart(3, "0")}-${"data".repeat(25)}.txt`,
            `large-${index}`,
          ),
        );
    return Response.json({ stream: "kopia:directory", summary, entries });
  }
  throw new Error(`Unexpected fixture request ${url.pathname}`);
};
const root = createRootRoute({
  component: () => (
    <div className="flex h-full min-w-0 flex-col overflow-auto">
      <Outlet />
    </div>
  ),
});
const account = createRoute({
  getParentRoute: () => root,
  path: "$accountId",
  component: () => (
    <>
      <CompactNavigation />
      <Outlet />
    </>
  ),
});
const home = createRoute({
  getParentRoute: () => account,
  path: "/",
  component: AccountHome,
});
const activity = createRoute({
  getParentRoute: () => account,
  path: "activity",
  component: AccountActivity,
});
const vaultRoute = createRoute({
  getParentRoute: () => account,
  path: "$vaultId",
  component: Outlet,
  validateSearch: (search) => ({
    otherHostName: search.otherHostName,
    otherUserName: search.otherUserName,
  }),
});
function Overview() {
  const { vaultId } = useParams({ strict: false });
  useSearch({ strict: false });
  return (
    <VaultOverview vault={fixtureVaults.find((item) => item.id === vaultId)} />
  );
}
const overview = createRoute({
  getParentRoute: () => vaultRoute,
  path: "/",
  component: Overview,
});
const sourceRoute = createRoute({
  getParentRoute: () => vaultRoute,
  path: "$sourceId",
  component: Outlet,
});
const sourceHistory = HistoryRoute.update({
  id: "/",
  path: "/",
  getParentRoute: () => sourceRoute,
});
const comparison = CompareRoute.update({
  id: "/compare",
  path: "/compare",
  getParentRoute: () => sourceRoute,
});
const snapshotRoute = createRoute({
  getParentRoute: () => sourceRoute,
  path: "$backupId/$directoryId",
  component: Outlet,
});
const browser = BrowserRoute.update({
  id: "/",
  path: "/",
  getParentRoute: () => snapshotRoute,
});
const router = createRouter({
  routeTree: root.addChildren([
    account.addChildren([
      home,
      activity,
      vaultRoute.addChildren([
        overview,
        sourceRoute.addChildren([
          sourceHistory,
          comparison,
          snapshotRoute.addChildren([browser]),
        ]),
      ]),
    ]),
  ]),
  history: createMemoryHistory({
    initialEntries: [`/local/vault-a/${encodeURIComponent(sources[0].id)}`],
  }),
});
window.historyFixture = {
  online: (value) => onlineManager.setOnline(value),
  setReadMode: (value) => {
    mode = value;
  },
  source: sources[0],
  mode: async (value) => {
    mode = value;
    await client.cancelQueries();
    client.clear();
  },
  aborted: () => aborted,
  home: () =>
    router.navigate({ to: "/$accountId", params: { accountId: "local" } }),
  compare: () =>
    router.navigate({
      to: "/$accountId/$vaultId/$sourceId/compare",
      params: {
        accountId: "local",
        vaultId: "vault-a",
        sourceId: sources[0].id,
      },
      search: {
        snapshot: "snapshot-1",
        otherHostName: "archive-pc",
        otherUserName: "sam",
      },
    }),
  overview: (vaultId = "vault-a") =>
    router.navigate({
      to: "/$accountId/$vaultId",
      params: { accountId: "local", vaultId },
    }),
  storageSpace: async (vaultId, value) => {
    storageSpaces.set(vaultId, value);
    await client.invalidateQueries({
      queryKey: ["local", "vault", vaultId, "storageSpace"],
    });
  },
  location: () => ({
    pathname: router.state.location.pathname,
    search: router.state.location.search,
    params: router.state.matches.at(-1).params,
  }),
};
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={client}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
