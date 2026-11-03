# M2 slice — Nonmutating repository discovery in the owned core fork

Initial verification: 2026-11-02; updated 2026-11-03 after managed-provider integration and source publication. Application base: `d63593263db0a8f60b8b56240873a35b65009643`; original core baseline: `e8955e7280edd9526b9f104f1592f233cfe6789b`. Changes are now merged into application `main` at `d45cda77b5a9c166a9d430fd3aabdd918730fc46`, with published core pin `aad67c688a05ce119859d49ca51bdf67787f0b99`. See [provenance](../../UPSTREAM.md) and [Windows CI](m2-provider-storage-design.md#source-publication-and-windows-ci).

## Scope and requirements

This verifies the **discovery portion of P01/F02**, with supporting **F03, F01 and basic F17** compatibility evidence. It removes three inherited writes during provider/repository discovery:

- `/repo/exists` reads `kopia.repository`, falling back to `blinkdisk.repository` only on a missing blob. It no longer calls legacy-blob migration. A malformed/unreadable current blob remains an error; a legacy copy cannot mask it.
- Sharded storage reads and metadata queries use in-memory defaults when `.shards` is absent. The first blob write still persists its layout. A write after an earlier read rechecks for a `.shards` file created by another client.
- SFTP opens an absent remote destination without creating directories when `isCreate=false`. Subsequent reads report missing blobs. Explicit creation still creates the destination; initialization failures close the opened connection.

Discovery returns the existing identity and preserves exact supplied passwords. Wrong passwords, malformed data and inaccessible local paths remain errors. A missing filesystem root retains its inherited storage-access error; it is not classified as an empty repository. No repository-format or encryption change was introduced.

**This does not close M2 or F03.** Subsequent [create/connect evidence](m2-create-connect.md) covers separate entry points and explicit connection's inherited legacy migration; the source handoff pins the published initialization guard at `5971b879111001ba4c8d0e41659723d79565f06d`. Renderer restore terminal outcomes, full recovery/interruption/network verification and the live-provider/platform matrices remain open. Provider-secret storage is covered by the [approved managed-storage slice](m2-provider-storage-design.md).

## Fork and build identity

The owner approved `hoxsec/diskpond-core`, created as a fork of `blinkdisk/core`. `.gitmodules` and local `origin` select the owned fork; local `upstream` retains the original URL. Implementation branch `diskpond/m2-discovery` and core `main` are published; the application gitlink pins the merged revision above.

The build validates core HEAD against the index gitlink. Initial local verification identified the modified baseline as:

```text
0.0.0-diskpond-dev build: e8955e7280edd9526b9f104f1592f233cfe6789b-dirty from: hoxsec/diskpond-core
```

The source is now published and the gitlink advanced, so clean Windows CI builds the same reviewed source at `aad67c688a05ce119859d49ca51bdf67787f0b99` without a `-dirty` suffix. Discovery and baseline-copy recovery, packaging and installed-startup smoke pass in both published runs linked above.

## Checks and reproduction

Windows 11 x64; Node 24.14.0 locally (repository/CI pin 24.15.0), pnpm 11.7.0, Go 1.25.5 and Electron 42.11.16. Portable Go was invoked by its absolute path locally because `go` is not on the shell PATH. Fixtures use isolated temporary directories; the developer's DiskPond profile and repositories were not exercised.

```powershell
pnpm install --frozen-lockfile
# From apps/core, with Go on PATH:
go test -tags testing -count=1 -timeout 120s ./repo/blob/sharded ./repo/blob/sftp -run 'TestSharded|TestClone|TestSFTPDiscovery'
go test -tags testing -count=1 -timeout 120s ./repo/blob/filesystem ./repo/format
go test -tags testing -count=1 -timeout 120s ./internal/server -run '^TestRepoExistsDoesNotModifyStorage$'
# From the application root:
pnpm build:core
$env:DISKPOND_TEST_TMP = 'C:\Users\HOXSEC\AppData\Local\Temp\opencode'
pnpm smoke:discovery
pnpm smoke:passwords
pnpm smoke:desktop
pnpm lint:ci
pnpm unused
```

| Check | Result |
| --- | --- |
| Frozen install | Pass; no lockfile/dependency change. |
| Sharding and SFTP discovery regressions | Pass. Both legacy/default-new layouts read without `.shards`, preserve the first-write/reopen behavior and respect a newly appearing sharding file. Real SSH/SFTP client talks to a local in-memory server with a pinned host key; discovery sends zero mutating requests, explicit creation can write/read. |
| Full filesystem and format package suites | Pass. No Docker/live-provider prerequisite for these selections. |
| Server discovery regression | Pass: **13 storage cases**, including null and missing-identity blobs. Each uses omitted, correct whitespace-bearing, and wrong passwords: **39 requests**. Compares all directory/file entries plus file modes, sizes, modification times and SHA-256 hashes. |
| Native core build | Pass; owned fork and `-dirty` source identity printed. |
| `pnpm smoke:discovery` using the retained clean baseline binary | Pass, repeated on the final managed-core build: **24 discovery requests across eight destinations and eight versioned restores/hash comparisons** across four copied repositories. |
| `pnpm smoke:discovery` with automatic clean-baseline build | Pass; exact baseline built from the temporary worktree, all discovery and two-version restore/hash checks pass, worktree/fixtures cleaned. |
| Password smoke against the modified core | Pass, repeated after managed startup: all seven native phases and three repositories, including exact-password automatic reopening, interruption/reconnect, session-only/locked/failing protection and credential-file scans. |
| Built desktop smoke with empty-destination assertion | Pass, repeated on the final production build: onboarding, preferences, IPC rejection and discovery leave the destination empty. Zero remote renderer/main-fetch requests in that exercised flow. |
| Lint / dependency analysis | Initial discovery run passed 684 files and `pnpm unused`; current combined results are in the [provider-storage record](m2-provider-storage-design.md). |
| Windows CI / installed artifact | Published integration and merged-main runs pass discovery, packaging and installed-startup smoke. See the publication record linked above. |
| Live providers / other OSes | Not certified by this slice. |

The first server-regression attempt exposed two fixture assumptions: filesystem initialization returns an access error for a missing root, and Windows can defer directory timestamp updates from fixture creation. Corrected expectations preserve the access error and compare the complete entry set plus file metadata/hashes. No product workaround was needed for those two failures.

### Baseline compatibility fixture

`scripts/smoke-discovery.mjs` builds the exact baseline from a disposable detached core worktree by default. `DISKPOND_BASELINE_CORE` can instead select an already-built clean baseline executable; the runner checks its printed revision. The default requires that baseline commit to exist in the local core object database. CI explicitly fetches that exact revision after the shallow checkout; [DEVELOPMENT.md](../../DEVELOPMENT.md#prepare-the-checkout) documents the same command. It never checks out over the candidate core. The temporary worktree, fixture profiles and repositories are removed after the run.

The clean baseline creates snapshot A containing empty files/directories, nested and Unicode paths, a 1 MiB file and a file later deleted. The source is changed/deleted/extended and snapshot B is created with forced hashing. Copies are prepared as current-name, legacy-name, current-without-`.shards`, and legacy-without-`.shards` repositories. A `{3,3}` sharding layout is deliberately used before removing the marker so these model readable older layouts rather than damaging newer `{1,3}` repositories. Legacy-name cases are constructed by renaming central blobs in the disposable copies; they are not a claim of testing every historical BlinkDisk release.

The Electron fixture calls the real `validateVaultConfig` → supervised, certificate-verified loopback engine path for those copies, empty/missing/unrelated destinations and a corrupt-current/valid-legacy case. It checks identity, passwords and unchanged contents/metadata before and after discovery. It then exits. Separate candidate-core CLI processes explicitly connect to each valid copy and restore A and B into independent destinations. All restored file hashes and directory entries match their expected version, including the deleted file in A and its absence in B.

These are real-engine compatibility/restore checks after discovery, not an end-to-end renderer backup/restore journey. Explicit connection remains allowed to run its inherited migration; discovery itself performs no connection, repository initialization, policy change, maintenance or migration. Symlinks/junctions, ACL/owner/timestamp restoration, interrupted restores, retention and all restore UI outcomes remain unverified here.

The current smoke runner disables the core's independent update check in its fixture environments. No claim of complete socket observation or offline certification follows from that setting. The baseline CLI's automatic maintenance runs only against disposable fixture repositories.

## Subsequent credential integration

The owner approved and the published implementation provides Electron-owned OS-protected/session-only provider connections, metadata-only managed core configuration and migration of both inherited local credential forms. See [provider lifecycle, implementation and evidence](m2-provider-storage-design.md) and the updated [password slice](m2-password-storage.md). The application pins the published core; the original baseline and upstream provenance remain recorded.
