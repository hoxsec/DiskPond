import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBackupFolders, startFolderBackups } from "@electron/backup-folders";

const mocks = vi.hoisted(() => ({
  paths: new Map<string, string>(),
  connection: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("electron", () => ({
  app: {
    getPath: (kind: string) => {
      const path = mocks.paths.get(kind);
      if (!path) throw new Error("Unknown OS location");
      return path;
    },
  },
}));
vi.mock("@electron/vault/manage", () => ({
  getVault: () => ({ id: "vlt_test" }),
}));
vi.mock("@electron/profile", () => ({
  getHostName: () => "here",
  getUserName: () => "sam",
}));
vi.mock("@electron/vault/connection", () => ({
  getConnection: mocks.connection,
}));
vi.mock("@electron/vault/fetch", () => ({ fetchVault: mocks.fetch }));

let directory: string;
const vaultId = "vlt_test";
beforeEach(async () => {
  directory = await realpath(
    await mkdtemp(
      join(process.env.DISKPOND_TEST_TMP || tmpdir(), "diskpond-folders-"),
    ),
  );
  mocks.paths.clear();
  mocks.paths.set("home", directory);
  mocks.connection.mockReturnValue({ type: "s3", config: {} });
  mocks.fetch.mockReset().mockResolvedValue({ sources: [] });
});
afterEach(() => rm(directory, { recursive: true, force: true }));

it("offers an OS-redirected folder only once and never suggests the home directory as a fallback", async () => {
  const photos = join(directory, "Fotos");
  await mkdir(photos);
  const file = join(directory, "file.txt");
  await writeFile(file, "file");
  mocks.paths.set("documents", directory);
  mocks.paths.set("pictures", photos);
  mocks.paths.set("desktop", photos);
  mocks.paths.set("downloads", file);
  mocks.paths.set("videos", join(directory, "offline"));
  expect(await getBackupFolders({ vaultId })).toEqual([
    expect.objectContaining({
      kind: "pictures",
      path: photos,
      alreadyAdded: false,
    }),
  ]);
  expect(mocks.fetch).toHaveBeenCalledWith(expect.anything(), {
    method: "GET",
    path: "/api/v1/sources",
    search: { host: "here", userName: "sam" },
  });
});

it("rechecks local vault overlap and existing source policies when the user confirms", async () => {
  const documents = join(directory, "Documents");
  const storage = join(documents, "vault");
  const child = join(storage, "data");
  await mkdir(child, { recursive: true });
  const alias = join(directory, "another-name");
  await symlink(
    storage,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  const existing = join(directory, "existing");
  await mkdir(existing);
  mocks.connection.mockReturnValue({
    type: "filesystem",
    config: { path: storage },
  });
  mocks.fetch.mockResolvedValue({ sources: [{ source: { path: existing } }] });
  const ineligible = [documents, child, alias];
  for (const path of ineligible)
    expect(await getBackupFolders({ vaultId, path })).toEqual([]);
  expect(await getBackupFolders({ vaultId, path: existing })).toEqual([
    expect.objectContaining({ alreadyAdded: true }),
  ]);
  expect(
    await startFolderBackups({
      vaultId,
      folders: [...ineligible, existing].map((path) => ({
        path,
        key: process.platform === "win32" ? path.toLowerCase() : path,
        name: "Must not replace policy",
      })),
    }),
  ).toEqual({ failed: ineligible });
  expect(
    mocks.fetch.mock.calls.every(([, request]) => request.method === "GET"),
  ).toBe(true);
});

it("preserves the displayed OS alias and refuses to back up a different target after review", async () => {
  const alias = join(directory, "Pictures");
  const original = join(directory, "old");
  const replacement = join(directory, "new");
  await Promise.all([mkdir(original), mkdir(replacement)]);
  const type = process.platform === "win32" ? "junction" : "dir";
  await symlink(original, alias, type);
  mocks.paths.set("pictures", alias);
  const [reviewed] = await getBackupFolders({ vaultId });
  expect(reviewed?.path).toBe(alias);
  if (!reviewed) throw new Error("Missing Pictures suggestion");
  await rm(alias);
  await symlink(replacement, alias, type);
  const { path, key, name } = reviewed;
  expect(
    await startFolderBackups({ vaultId, folders: [{ path, key, name }] }),
  ).toEqual({ failed: [alias] });
  expect(
    mocks.fetch.mock.calls.every(([, request]) => request.method === "GET"),
  ).toBe(true);
});
