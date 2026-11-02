# M1 — Windows import and build baseline

Date: **2026-11-02**. Status: **local baseline verified; clean Windows runner reproduction pending**.

This record supports the foundations for DP01/DP03/DP04 and F22/F24/F25/F26. It does not certify those full requirements or any P01–P11 backup/restore round trip. M1 remains active until its clean-runner gate passes.

## Source and environment

| Item | Recorded value |
| --- | --- |
| DiskPond branch / original HEAD | `integrate/blinkdisk-baseline` / `ef03111` (original local verification before the CI handoff) |
| Application import | `blinkdisk/blinkdisk@e435469b3d09b8c217417d1325331865e483ce2f` |
| Core gitlink / checkout | `blinkdisk/core@e8955e7280edd9526b9f104f1592f233cfe6789b`; core source clean |
| Host | Windows 11 Pro x64, version `10.0.26200`, build 26200 |
| Node / pnpm / Go | `24.14.0` / `11.7.0` / `go1.25.5 windows/amd64` |
| Electron / electron-builder | `42.11.16` / `26.15.3` |
| TypeScript / Vite / Vitest / Biome | `6.0.3` / `8.1.6` / `4.1.12` / `2.5.1` |
| Workflow validator | actionlint `1.7.7` |

Portable Go was downloaded from the official `go1.25.5.windows-amd64.zip` release and verified against SHA-256 `ae756cce1cb80c819b4fe01b0353807178f532211b47f72d7fa77949de054ebb`. Corepack pnpm shims and Go were added only to the execution PATH. The ordinary desktop setup used no `.env`, API/database services, hosted account or signing certificate.

[UPSTREAM.md](../../UPSTREAM.md) records the import, attribution, remotes and changed upstream files. [DEVELOPMENT.md](../../DEVELOPMENT.md) is the reproducible command guide.

## Inherited baseline and resolutions

| Initial observation | Resolution / remaining limitation |
| --- | --- |
| Frozen pnpm install succeeded, but Electron's executable was absent | Explicit `install-electron` in dev/preview/smoke runners. Exact Electron package stays pinned. |
| Initial Turbo type command could not locate pnpm | Add a Corepack pnpm shim to PATH. All 15 inherited type tasks then passed. Root defaults are now desktop-scoped to avoid starting service tooling. |
| Initial tests: schemas 20 passed, utils 62 passed, desktop 290 passed / 1 failed; Electron reported two failures before the parallel run stopped | Locale-aware number assertion and native path assertions fixed; core path now targets the workspace-built executable. Final full relevant suites pass below. |
| Initial lint 1,804 errors; 1,089 remained after LF checkout | `.gitattributes` enforces LF; the Grit alias rule now recognizes `/` and `\`. Format only changed/new implementation files. Final lint passes. |
| POSIX `rm`/`cp` wrappers, development core path pointed at a global Go binary | Node file/process wrappers, shared native-target mapping, revision-aware core build. |
| Concurrent pnpm commands after manifest edits raced on Windows `.bin` files | Serialized install after edits, then independent checks. Final frozen install succeeds. |
| Windows shell treated the single-quoted library filter literally | Double-quoted `"./libs/*"` now includes libraries: 15 packages selected, 11 with `types` scripts. |
| Upstream desktop build plugins attempted Sentry uploads/telemetry | Removed desktop Vite/esbuild upload plugins, forced empty analytics keys, disabled Sentry initialization, and prevented LogSnag calls without a key. SDK/service removal is M2. |
| Knip initially missed packaging constants and the cross-workspace Electron runner | Register config/script entry points; narrowly document Electron resolution, Windows built-ins and intentional APP_ID/APP_SCHEME alias. Final Knip passes. |
| GitHub `runner.temp` was invalid in workflow/job-level `env` | Move it to individual smoke-step environments; actionlint passes. |
| Development smoke registered the production URI handler, interfering with installed-smoke preflight | Restrict OS registration to packaged builds. Three regression cases cover unpackaged link handling without registration, packaged registration and failure reporting. Windows built/dev smoke compares registry state before and after; installed smoke checks that its handler points to the fixture executable. |

The alias-rule check used disposable real source files: a same-package `@desktop/...` import passed, while the same import from `libs/utils` failed with the expected plugin diagnostic. The probes were removed afterward. Biome's stdin mode did not exercise the Grit plugin equivalently and is not the passing evidence.

## Passing local checks

| Command / scenario | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass with pnpm 11.7.0 after intentional manifest/lockfile synchronization. |
| `pnpm lint:ci` | Pass: 733 source files checked after adding the installed smoke runner. |
| `pnpm types:desktop` | Pass: Electron, desktop and all inherited libraries with a type script (11 tasks). |
| `pnpm test:desktop`; final `pnpm --filter @blinkdisk/electron test` | Full baseline passed 514 tests/55 files; final affected Electron rerun passed 144/16 after adding three URI regressions. Combined current coverage: **517 tests in 55 files** — schemas 20/5, utils 62/8, Electron 144/16, desktop 291/26 (tests/files). |
| `pnpm unused` | Pass: whole imported workspace, including packaging config and new runners. |
| `pnpm build:core` | Pass; native Windows executable reports exact pinned revision. |
| `pnpm build:desktop` | Pass: native engine, Vite renderer, copied frontend, main and preload. |
| `pnpm smoke:desktop` | Pass: built frontend via internal protocol; actual local-onboarding buttons; app name/data isolation; preload version IPC; real engine discovery; unchanged Windows URI registration. |
| `pnpm smoke:desktop --dev` | Pass through `dev:desktop`: Vite + compiler + Electron startup, unchanged Windows URI registration and process-tree cleanup. |
| `pnpm build:windows` | Pass: unsigned x64 NSIS installer and `win-unpacked`, with project licenses/provenance and bundled core; `--publish never`. |
| `pnpm smoke:windows` | Pass for installed first launch, URI handler pointing to the installed executable, local onboarding, IPC version, packaged engine discovery, license texts/feed metadata, normal quit and executable removal. Known registry leftovers are recorded below and fixture-cleaned. |
| `actionlint .github/workflows/desktop.yml` | Pass. Hosted Actions execution remains pending. |

The engine reports:

```text
0.0.0-diskpond-dev build: e8955e7280edd9526b9f104f1592f233cfe6789b from: blinkdisk/core
```

The built/installed smoke probes an empty destination using `window.electron.vault.validate`. It expects `NOT_INITIALIZED` and the inherited `.shards` marker, rather than treating validation as a created repository or asserting read-only behavior. No real backup repository or developer source data is used. Built/dev smoke runs block remote renderer HTTP(S) requests and observed none on the exercised path. That interception does not cover all Node/Go/updater traffic.

Installed smoke uses NSIS `/S /D=<disposable-directory>`, the actual installed `DiskPond.exe`, ephemeral loopback inspector/renderer debugging connections, then normal application quit and `Uninstall DiskPond.exe /S`. It requires no existing DiskPond data/install/startup/URI registration. Fixtures are marked; cleanup removes only those fixtures and registry entries still pointing to the disposable executable. It is appropriate on a fresh test user/runner, not an existing DiskPond installation. An initial harness attempt attached before `document.body` existed; readiness now waits for the rendered page and the final run passes.

After the URI fix, the final local sequence passed in workflow order: `build:windows` → `smoke:desktop` → `smoke:desktop --dev` → `smoke:windows`. Production main/preload output was then restored with `pnpm --filter @blinkdisk/electron compile:prod`. Final inspection found zero smoke processes or fixture directories, no packaged fixture data, and no DiskPond startup value or URI registration. The core checkout remained clean at its pinned revision.

### Development artifacts

These are local test artifacts, not released binaries. Source-only edits do not promise byte-identical installers across builders.

| File | SHA-256 at verification |
| --- | --- |
| `apps/core/dist/kopia_windows_amd64/kopia.exe` | `b88cc137fd739c1dbb3b6ff585ae1b6d27efa73104e9dd80ad0e956c1e476a22` |
| `apps/electron/dist/win-unpacked/resources/binaries/kopia.exe` | Same hash as the built core |
| `apps/electron/dist/DiskPond-Windows.exe` | `24c5381bdb1d0f6f6fed69b82a5c5fc636d0774aa655949c0daf98240670a422` |

Authenticode inspection returns `NotSigned`; packager log lines mentioning signing tools do not establish a signature. Included project licenses and `UPSTREAM.md` match their source files. Packaged `resources/app-update.yml` contains owner `hoxsec`, repo `DiskPond`, and updater cache name `diskpond-updater`.

## Identity contract established in M1

| Surface | Value |
| --- | --- |
| Product, executable and startup entry | `DiskPond` / `DiskPond.exe` / `DiskPond` |
| App ID / public URI scheme | `io.github.hoxsec.diskpond`; OS URI registration is packaged-only |
| Internal renderer/API/vault protocol | `diskpondapp` |
| Packaged data root | `%APPDATA%\diskpond` |
| Unpackaged data root | `%APPDATA%\diskpond-dev`, or absolute `DISKPOND_DATA_DIR` fixture override |
| Packaged updater cache / feed | `diskpond-updater` / GitHub `hoxsec/DiskPond` |
| Root/package metadata and artifacts | Root `diskpond`; packaged metadata `diskpond`; `DiskPond-Windows.exe` |

Private workspace package names and the external `@blinkdisk/signaldb-electron` package are retained intentionally. Original UI/logo replacement is M2, and engine cache/log isolation still needs auditing alongside its lifecycle. Existing BlinkDisk settings/credentials are not automatically imported.

## Recorded gaps and next gate

1. **M1 gate still pending:** run `.github/workflows/desktop.yml` on a clean Windows runner and link evidence. The owner has authorized committing/pushing the integration branch; a remote passing result is not yet claimed.
2. **Installed-artifact finding, F22/F26:** inherited uninstall removes application files but leaves the app-created startup value and URI registration. The installed smoke reports and removes only its own leftover entries. Fix and certify real uninstall/upgrade behavior in M5; this is not a full uninstall acceptance pass.
3. **Safe discovery, F02/F03:** `.shards` is created during validation and the engine's endpoint may migrate legacy blob IDs. Resolve a read-only discovery path in M2/M3 before exposing compatible repository connection as verified.
4. **M2 remains:** local workspace default, service/SDK extraction, secure-storage fallback, original UI and real snapshot/restore/hash verification. Startup alone does not pass DP01/DP03 or Q01.
5. **Platforms:** Windows 10 and fresh-OS installations/upgrades are untested; macOS 12 minimum conflicts with upstream's Big Sur claim; Linux ARMv7 archive availability is not runtime certification. See [platform findings](m1-platforms.md).
6. **Informational inherited warnings:** Vite's tsconfig-paths deprecation, large renderer chunks, Node's module-type inference for the shared TS target helper, inactive PostHog provider, and packager optional dependencies for other architectures. These did not fail the recorded checks; extraction/performance work remains milestone-scoped.

Raw local command logs stayed under the session temporary directory (`diskpond-baseline-*`, `diskpond-m1-*`). This document records stable commands, results and limitations without copying machine-specific paths into exported evidence. The subsequent owner-authorized CI handoff publishes the source branch; no tag or binary release is included.
