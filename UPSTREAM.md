# DiskPond upstream provenance

Updated 2026-11-03. DiskPond is derived from BlinkDisk and its Kopia-derived core.

| Component | Exact baseline | License |
| --- | --- | --- |
| Application | [`blinkdisk/blinkdisk@e435469b3d09b8c217417d1325331865e483ce2f`](https://github.com/blinkdisk/blinkdisk/tree/e435469b3d09b8c217417d1325331865e483ce2f) | AGPL-3.0, retained in [LICENSE](LICENSE) |
| Engine submodule | [`blinkdisk/core@e8955e7280edd9526b9f104f1592f233cfe6789b`](https://github.com/blinkdisk/core/tree/e8955e7280edd9526b9f104f1592f233cfe6789b) | Apache-2.0, retained in [apps/core/LICENSE](apps/core/LICENSE) |

Credit and copyright remain with their respective contributors. Kopia provides the underlying backup engine; see [kopia/kopia](https://github.com/kopia/kopia). Bundled dependencies and assets retain their own licenses. This document records the fork; it does not replace those terms or grant use of upstream trademarks.

## Import record

The import started from DiskPond commit `ef03111` on `integrate/blinkdisk-baseline`. Existing history, `.gitattributes`, and DiskPond's four planning/contributor documents were preserved. The upstream application commit and its ancestors were fetched into the local repository, with a local reference at `refs/remotes/upstream/diskpond-baseline`. The owner authorized committing and pushing this integration branch for Windows CI. The import commit retains both `ef03111` and the pinned upstream application commit as parents; the following commit records the Windows adaptations and DiskPond documents. No tag or binary release is part of this CI handoff.

Remotes used:

- `origin`: `https://github.com/hoxsec/DiskPond.git`
- `upstream`: `https://github.com/blinkdisk/blinkdisk.git`
- `apps/core`: `https://github.com/blinkdisk/core.git`, detached at the gitlink above.

The recorded procedure was:

1. Create the integration branch from existing DiskPond history.
2. Fetch the exact application commit with `git fetch --no-tags upstream <application-commit>`; record the local baseline ref.
3. Materialize its tree into the working directory, excluding DiskPond's `AGENTS.md`, `.gitattributes`, `PLAN.md`, `ROADMAP.md`, and `STYLE.md`.
4. Record `.gitmodules` and the exact `apps/core` gitlink; run `git submodule update --init --depth 1 --checkout apps/core`.
5. Enforce LF checkout in `.gitattributes`; retain the inherited workspace layout, package exports, lockfile, dependency patch and copyright/license headers.
6. For the CI handoff, record the upstream tree with the original DiskPond `.gitattributes` as a two-parent import commit, then record the reviewed working tree as the adaptation commit. Temporary Git indexes prepare these trees without replacing the working files or planning documents.

Do not replay the tree import over later work. A future clone recreates the core using the committed gitlink, not `--remote`. The upstream `branch = main` hint was removed from `.gitmodules`. The core build checks the checkout against the index gitlink before compiling.

## DiskPond modifications to upstream application files

These changes are dated **2026-11-02**, during M1. Review them independently of the source import. The core source was unchanged at M1; subsequent published core changes are recorded below.

| Area | Changed inherited files / purpose |
| --- | --- |
| Contributor and user documentation | `AGENTS.md` reconciles upstream guidance with account-free DiskPond decisions; `CLAUDE.md` still references it. `README.md`, `DEVELOPMENT.md`, and `.env.template` replace service-era setup/product instructions. |
| Tooling | Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and both desktop/electron manifests establish desktop commands and remove desktop Sentry upload-plugin dependencies. `knip.config.ts` recognizes packaging/scripts; `libs/biome/no-cross-package-alias.grit` recognizes Windows separators. |
| Identity / packaging | `libs/constants/src/app.ts`, `apps/electron/electron.builder.ts`, `src/path.ts`, `src/window.ts`, `src/startup.ts`, `src/tray.ts`, and `apps/desktop/index.html` use DiskPond runtime, storage, startup, URI and artifact identities. Workspace-only `@blinkdisk/*` names are retained initially. |
| Development isolation | `apps/electron/src/deeplink.ts` restricts OS URI registration to packaged builds so dev/preview runs preserve the installed handler; `src/deeplink.test.ts` covers registration, failure reporting and link handling with the DiskPond scheme. |
| Build / initial privacy defaults | `apps/desktop/vite.config.ts`, `apps/electron/esbuild.config.mjs`, their `src/main.tsx` / `src/index.ts` / `src/preload.ts`, and `apps/desktop/src/hooks/use-logsnag.ts` disable desktop Sentry initialization/uploads and analytics keys/LogSnag transmission. Full SDK/service removal remains M2. |
| Windows regression assertions | `apps/electron/src/path.test.ts`, `src/db/sync.test.ts`, and `apps/desktop/src/lib/number.test.ts` cover native paths, engine locations and locale-aware formatting. |
| CI | Nine inherited deployment/quality workflows are replaced by `.github/workflows/desktop.yml`, a secret-free Windows desktop/core check with no publishing step. |

New implementation files are `scripts/` build/dev/smoke runners, `libs/constants/src/core.ts`, `apps/electron/src/identity.ts`, and `docs/verification/`. Original planning files continue to track actual milestone progress.

The lockfile was regenerated with pnpm 11.7.0 after removing the two desktop upload-plugin imports. The resulting diff removes the unused esbuild plugin, collapses duplicate existing optional `@emnapi/runtime` peer snapshots to the already-locked 1.11.3 resolution, and refreshes two deprecation annotations. No broad dependency update was requested. Use frozen installation thereafter.

## M2 branding/local-workspace changes

The owner-supplied DiskPond SVG wordmark/drive icon replaces inherited product artwork in the shared logo, favicons, native app/installer and tray. `scripts/build-branding.mjs` generates the derivatives with pinned resvg. Shared light/dark tokens follow STYLE.md.

Desktop auth/account switching, CloudBlink, billing, quotas, promotions and telemetry UI/hooks are removed. Electron no longer imports hosted auth/sync/tRPC clients, token migrations, hosted API proxying or Sentry. Local collection filenames and encrypted configuration formats are retained; a local-only migration selects the workspace without touching dormant hosted account collections. Shared config-level/vault-status contracts no longer import the hosted database schema. Engine source/gitlink and license material are preserved.

Verification and outstanding M2 work: [branding/workspace record](docs/verification/m2-branding-workspace.md). Retained service applications and their own dependencies are not desktop deliverables.

The M2 lockfile was regenerated with pnpm 11.7.0 from the baseline resolutions. Its only new package family is the pinned artwork renderer `@resvg/resvg-js@2.6.2` and platform bindings; removed entries follow the retired desktop dependencies. The local-engine cookie dependencies remain at `tough-cookie@6.0.1` and `tldts`/`tldts-core@7.4.4`.

## Repository branding follow-up (2026-11-03)

For DP04, the inherited GitHub sponsorship destination was cleared and the development environment display name changed to `diskpond`. The root README and Electron profile implementation references now link to the owned core fork (profile references use the pinned revision). Package-local READMEs identify retained hosted apps/email templates as upstream-only sources, with no DiskPond service claims. License/attribution, private package names, external dependencies and persisted compatibility identifiers remain intact. This metadata/documentation cleanup does not advance M2's recovery gate.

## Desktop identity refinement (2026-11-03)

For D10 / DP04 / F23, the owner selected graphite/blue, clean technical styling, square UI corners throughout, the existing DiskPond artwork and a Settings-only theme selector. Changes to `libs/styles/globals.css`, shared UI primitives, desktop vault cards/loading presentation and the Electron startup background implement this direction. Inherited pill/fixed-radius overrides and decorative vault-card hardware are replaced by flat, token-based styling. Toasts use semantic status colors and the active theme; skeletons use shared surface/shape tokens. [Verification](docs/verification/graphite-blue-identity.md) records the scoped build, contrast and desktop checks.

## Profile/history navigation (2026-11-03)

For F15 / F16 / F20 / DP04, the inherited source-history route now links back to its vault and the overview exposes a device/user filter-reset action. Snapshot browsing also links directly back to source history from root or nested folders. Source-card, snapshot-card and menu links preserve profile search parameters; returning to history clears the snapshot breadcrumb. English labels, accessible link names, focus handling and responsive layout accompany the changes in `apps/desktop/src/components/{sources/list,vaults/overview,backups/timeline}.tsx`, the source-history and snapshot-browser routes, and `locales/en/{backup,directory,folder,vault}.json`. [Verification](docs/verification/profile-history-navigation.md) records the scoped build and keyboard/zoom checks.

## Snapshot comparison and retained activity (2026-11-03)

For D14 / DP05 / DP06, new validated read contracts, bounded comparison traversal and shared Home/per-vault calendars build on the inherited history/browser API. Changes to inherited source-history/timeline/overview/Home components add entry points and placement; directory reads now preserve file size and use vault-scoped caches. Source-status changes and existing snapshot mutations refresh history queries. `apps/desktop/src/lib/vault.ts`, Electron `protocol.ts` and `vault/fetch.ts` propagate read cancellation; the existing authenticated boundary and core pin remain intact. English copy is in `locales/en/history.json`. [Focused verification and limitations](docs/verification/snapshot-comparison-and-activity.md) record the local batch. Repository formats, persisted contracts and licenses are unchanged.

## Vault available-space follow-up (2026-11-03)

For F06 / P01–P03, the inherited vault overview/stat-card, query keys, Electron connection IPC/preload and English vault copy now expose destination available space. New shared read-result validation, a bounded native filesystem probe and a vault-scoped renderer query use main-owned connection paths. Filesystem destinations report the current user's available bytes; other providers show **Not reported**, and failed reads show **Unavailable**. The new card has no historical trend. [Verification](docs/verification/vault-storage-space.md) records the feature released in v0.1.1.

## Remote available-space follow-up (2026-11-03)

Released in v0.1.2: Electron connection dispatch now supports [RustFS bucket quotas](docs/verification/rustfs-quota.md) and [SFTP available space](docs/verification/sftp-storage-space.md). New native-owned probes reuse saved credentials and the existing IPC read contract. The Electron manifest/lockfile add `aws4` and `ssh2`; esbuild bundles their JavaScript and retains their dependency licenses under `build/licenses`. Optional SSH native accelerators are disabled, with an ESM dirname shim for bundled CommonJS code. No core pin or repository format changes.

## M2 owned-core discovery work

On 2026-11-02 the owner approved and created [hoxsec/diskpond-core](https://github.com/hoxsec/diskpond-core), a GitHub fork of `blinkdisk/core`. The exact upstream baseline remains available in that fork. `.gitmodules` now selects the owned fork; local core `origin` points there and `upstream` retains `https://github.com/blinkdisk/core.git`.

The owner authorized publication on 2026-11-03. Branch `diskpond/m2-discovery`, based on `e8955e7280edd9526b9f104f1592f233cfe6789b`, contains implementation commit [`6e5c939`](https://github.com/hoxsec/diskpond-core/commit/6e5c939). It was merged and pushed to core `main` as [`aad67c688a05ce119859d49ca51bdf67787f0b99`](https://github.com/hoxsec/diskpond-core/commit/aad67c688a05ce119859d49ca51bdf67787f0b99), the application gitlink for that slice. Format discovery reads legacy names without migration, sharded reads no longer persist defaults, and SFTP only creates a missing destination during explicit creation. Focused regression files accompany those changes. Apache-2.0 terms, notices and the inherited Go module path remain intact.

`scripts/build-core.mjs` continues enforcing the gitlink and now embeds `hoxsec/diskpond-core` plus a `-dirty` revision suffix when local core changes exist. Initial local verification used the baseline with the reviewed source diff; a clean checkout now reproduces that source from the published pin. No tag or binary release accompanies this source publication.

Evidence and scope: [read-only discovery](docs/verification/m2-read-only-discovery.md). Provider storage and migration were subsequently approved and implemented as recorded below.

## M2 credential storage and managed-core changes

These changes were verified locally on Windows through 2026-11-03, starting from application `d63593263db0a8f60b8b56240873a35b65009643` and the original core baseline. Application implementation [`07014e1`](https://github.com/hoxsec/DiskPond/commit/07014e1f9f058643a7fcb66132dd566523b33892) and exact-baseline CI fix [`f289baa`](https://github.com/hoxsec/DiskPond/commit/f289baa31edcdc48169f4dc1ee5f661ba5150647) were pushed on `integrate/m2-credentials`, then merged into `main` as [`d45cda7`](https://github.com/hoxsec/DiskPond/commit/d45cda77b5a9c166a9d430fd3aabdd918730fc46). The core implementation is published at the pin above. Both [integration](https://github.com/hoxsec/DiskPond/actions/runs/41548458540) and [merged-main](https://github.com/hoxsec/DiskPond/actions/runs/41550252893) Windows CI passed; see [publication evidence](docs/verification/m2-provider-storage-design.md#source-publication-and-windows-ci). The dependency lockfile is unchanged by this slice.

| Area | Changed inherited files / purpose |
| --- | --- |
| Password and provider ownership | Electron `src/encryption.ts`, `src/password.ts`, `src/store.ts`, `src/db/index.ts` and new `src/vault/connection.ts` provide native-protected/session-only saves, bounded legacy reads, metadata-preserving migration, atomic JSON replacement and confirmed envelope cleanup. |
| Renderer/IPC boundary | Main/preload/IPC, protocol routing, new credential/context schemas/handlers, desktop create/setup hooks, configuration settings and query keys remove renderer-readable stored provider configs, generic secret access and password-bearing query keys. Localized notices explain credential re-entry and cleanup failures. |
| Engine supervision | Electron `src/vault/server.ts`, `manage.ts`, `fetch.ts`, `validate.ts` and new `reconnect.ts` start managed sidecars disconnected, supply exact credentials over authenticated loopback, confirm connection outcomes and handle failed/exited children. |
| Core managed persistence | `cli/command_server_start.go`, `internal/server/{api_repo,server}.go`, `repo/{local_config,connect,open,caching,repository}.go` and new `repo/config_store.go` preserve metadata/cache/bandwidth with provider data in memory, reject standalone managed reopening and restore prior metadata after failed verification. Current throttler limits replace stale startup values in client-option saves. |
| Core diagnostics | New `repo/managed_storage.go` redacts provider errors while preserving their identities. Managed connection/verification opens disable raw repository/content logs; main redacts process diagnostics. |
| Verification | Core managed lifecycle/redaction tests, Electron IPC/persistence/reconnect regressions, password/provider/discovery smoke runners and a loopback-only `tests/tools/diskpond-webdav` fixture. The published Windows workflow passes these checks, packaging and built/development/installed smoke on integration and merged `main`. |

The owner approved local migration of plaintext core connection JSON and inherited password-encrypted provider envelopes. Repository formats/encryption, Apache-2.0/AGPL notices, and the inherited Go module path are retained. Managed-mode changes are distinct from the earlier discovery fixes and remain separately inspectable by file/hunk. See [password evidence](docs/verification/m2-password-storage.md) and [provider decision/implementation/evidence](docs/verification/m2-provider-storage-design.md).

## M2 create/connect source handoff (2026-11-03)

The application separates create/connect entry points, strengthens main-owned destination/identity checks and returns verified identities for local descriptors. The core changes `repo/format/format_manager.go` and its tests to reject initialization when any repository blob remains, including legacy-only and damaged repositories. This guard changes no encryption or repository format. The inherited legacy connection migration was inventoried and recovery-tested on disposable baseline copies. See [create/connect evidence](docs/verification/m2-create-connect.md).

The owner requested commit/push publication and continuation with TODO item 2 in a new session. Application implementation [`b969093`](https://github.com/hoxsec/DiskPond/commit/b969093f813827d4fce4eb7ddaf04c04d01e0438) and core guard [`5971b87`](https://github.com/hoxsec/diskpond-core/commit/5971b879111001ba4c8d0e41659723d79565f06d) are published on their respective `main` branches. Initial CI exposed an inherited initialization test that hid format blobs in a nonempty repository; core [`dca6bebcba9c50f6f2658ae3662a52414f77bcf9`](https://github.com/hoxsec/diskpond-core/commit/dca6bebcba9c50f6f2658ae3662a52414f77bcf9) corrects that fixture using empty map storage and is the new application gitlink. Production engine behavior is unchanged by the test-only correction. Application [`a28d178`](https://github.com/hoxsec/DiskPond/commit/a28d178385d240ba677edf9e5ae85da2dcd86af2) pins the corrected core; [`5743e23`](https://github.com/hoxsec/DiskPond/commit/5743e23a86dbe6358ac5ceeadbdd53886377720b) updates the installed smoke's stale heading assertion. Local verification used the guard before commit (`aad67c6…-dirty`); the corrected core CI selection also passes locally. [Clean Windows CI run 41624170742](https://github.com/hoxsec/DiskPond/actions/runs/41624170742) passes on the published pair, including packaging and installed smoke. No tag or binary release is part of this handoff.

## Distribution and later updates

### v0.1.1 stable release (2026-11-03)

The owner-authorized available-space feature, compact Activity rows and Windows pnpm launcher fix are published as **v0.1.1**, GitHub Latest from `a3a4647`. Activity's inherited calendar now delegates backup/latest-issue rows to a shared expandable entry with keyboard support and preserved history/profile links; English labels and fixture coverage accompany it. The desktop process wrapper supports both JavaScript and standalone pnpm entry points, with a new subprocess regression in compact CI. Release CI, installed recovery and all downloaded asset checksums passed. [Release record](docs/verification/windows-v0.1.1.md).

### First stable public release (2026-11-03)

For D15 / DP04 / DP05 / F25, **v0.1.0** includes the notification-only GitHub update flow, Settings checks and the cold-start comparison-label fix in both history entry points. Each comparison entry now requests the history translation namespace explicitly. The README presents the released desktop app with real screenshots and features. `docker-compose.yml`, the empty `.github/FUNDING.yml` and redundant `.env.template` are removed; runtime options are documented in DEVELOPMENT.md. Stale release-status prose is consolidated in the active planning documents; historical evidence remains available.

Stable tag releases now become GitHub's Latest release, with version-specific public notes from `docs/releases/`. The core pin, repository formats, encryption and licenses are retained. [Release evidence](docs/verification/windows-v0.1.0.md).

The inherited `apps/api`, `apps/cloud`, `apps/web`, `apps/marketing` and `libs/emails` sources remain outside the desktop runtime/build. Their service copy describes upstream BlinkDisk, not DiskPond offerings. Private `@blinkdisk/*` package names, external dependencies and persisted compatibility identifiers retain their existing names.

### Windows release automation (2026-11-03)

The D13 release-first slice adds a tag-triggered GitHub Release workflow and source/checksum assembly, changes the default Windows workflow to compact checks, and retains the earlier extended suites as a manual workflow. Installed smoke now checks tagged application versions and performs a disposable bundled-core snapshot/restore hash comparison. The first unsigned `v0.1.0-alpha.1` prerelease was published with owner authorization; [verification](docs/verification/windows-release-cicd.md) records its release CI and checksums. The owner-authorized [v0.1.0-alpha.2 follow-up](docs/verification/windows-alpha-2.md) publishes the identity/navigation refinements above from application `f872617`, with passing release CI and downloaded checksums. Core source/gitlink, repository formats and license notices are unchanged by this UI release.

### M2 restore-outcome source handoff

The owner authorized committing and pushing the restore-outcome slice to application `main`. It changes inherited Electron restore coordination/IPC/preload, desktop restore hooks/result panels and English copy. New schemas, native path checks and native/component fixtures replace the inherited any-non-running-is-success shortcut. Selected items use validated engine tasks with preserved entry metadata; ignored errors/permissions are disabled. ZIP omissions found in the pinned writer are reported as partial. The unused `p-limit` direct dependency/catalog entry is removed through pnpm. Core source/gitlink, repository formats and license notices are unchanged. [Evidence and outstanding gates](docs/verification/m2-restore-outcomes.md) distinguish local verification from pending clean CI. No tag or binary release is included.

### Distribution requirements

The final restore-cleanup pin is [`0f31eefe409cb4f0571baf65abd7d063784598cd`](https://github.com/hoxsec/diskpond-core/commit/0f31eefe409cb4f0571baf65abd7d063784598cd). In addition to `945404f` below, `restore.Entry` closes output after copy failure/cancellation, preserving the primary error. Its regression uses an actual local source with write-time destination failure. This is the revision pinned by the application.

Core ZIP failure cleanup (2026-11-03): real full-volume Windows CI exposed an inherited open-handle leak in `snapshot/restore/zip_output.go` when archive finalization failed. Published core [`945404f`](https://github.com/hoxsec/diskpond-core/commit/945404fe056671797eb3aee4be71faebfcb47301) always closes the destination and preserves the finalization error, with a focused regression. The application deliberately advances its gitlink from `dca6beb` to this revision. ZIP contents, repository format, encryption, and Apache-2.0 notices are unchanged. Verification is tracked in [desktop recovery evidence](docs/verification/m2-desktop-recovery.md).

M2 lifecycle follow-up: `apps/electron/src/vault/server.ts` now rejects confirmed errors reopening saved repositories, instead of resolving a disconnected engine as setup-required. The server regression and built-desktop unavailable-storage/retry fixture cover this distinction; `locales/en/error.json` provides actionable engine/storage-unavailable copy. The disposable Windows CI fixture adds bounded-volume failure and scoped offline firewall checks. Core source, repository format and license material are unchanged.

The desktop account route also awaits its local vault collection's readiness before showing the workspace, avoiding an intermittent empty view when reopening from the tray. The recovery fixture covers active-backup cancellation/termination, protected/session-only restart, baseline-profile/registration isolation, read-only metadata and initial performance observations. Symlink and full-volume/offline acceptance require elevated CI evidence.

M2 desktop recovery follow-up (2026-11-03): the inherited source-history page's initial-backup Lottie animation attempted to download its WASM runtime from jsDelivr/unpkg. It now uses the existing local Lucide backup icon and retains the engine-backed progress display. The unused `@lottiefiles/dotlottie-react` dependency/catalog entry and its transitive player were removed using pnpm; no other locked resolutions changed. The built-renderer recovery fixture checks for remote Chromium requests during its journey. See [desktop recovery evidence](docs/verification/m2-desktop-recovery.md).

DiskPond's source/release namespace is `hoxsec/DiskPond`. Runtime identifiers are documented in [the M1 evidence](docs/verification/m1-windows-baseline.md). Existing BlinkDisk settings are not imported automatically.

Before distributing binaries, publish matching application and core source, build instructions, license/copyright material, dependency notices and checksums. Current development packaging includes both project license texts, owner artwork and this provenance record; a complete third-party notice review and release signing remain M5 gates. Build instructions are in [DEVELOPMENT.md](DEVELOPMENT.md).

Review upstream fixes deliberately. Advance application/core pins with compatibility evidence, rather than replacing the fork with stock Kopia or following a moving engine branch.
