# DiskPond development guide

Updated 2026-11-03. The Windows x64 development baseline and merged M2 credential/discovery slice pass locally and in clean Windows CI on both integration and merged `main`, including packaging and installed smoke. The published explicit create/connect slice also passes [clean Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41624170742). See [M1 evidence](docs/verification/m1-windows-baseline.md), [M2 publication/evidence](docs/verification/m2-provider-storage-design.md#source-publication-and-windows-ci), [create/connect evidence](docs/verification/m2-create-connect.md) and [TODO.md](TODO.md) for results and remaining product gates.

## Toolchain

| Tool | Pinned / tested version | Source |
| --- | --- | --- |
| Node.js | 24.15.0 pinned/CI; 24.14.0 also tested locally | `.nvmrc` pins 24.15.0; root manifest allows `>=24.14.0` |
| pnpm | 11.7.0 | Root `packageManager` |
| Go | 1.25.5 | `apps/core/go.mod`: language 1.25, toolchain go1.25.5 |
| Electron | 42.11.16 | Workspace catalog and lockfile |
| TypeScript / Vite / Vitest | 6.0.3 / 8.1.6 / 4.1.12 | Workspace catalog and lockfile |

Install Git with submodule support, Node and Go; make `git`, `node`, `pnpm` and `go` available on PATH. The desktop commands use Node for file operations and process supervision. PostgreSQL, Docker, GNU Make, hosted-service credentials and a `.env` file are unnecessary for this development path.

With Corepack available:

```powershell
corepack prepare pnpm@11.7.0 --activate
corepack enable pnpm
node --version
pnpm --version
go version
```

If the Node installation directory is not writable, install the Corepack shims into a user-owned directory and add it to PATH. A `pnpm` executable must be discoverable by nested package scripts; running only `corepack pnpm` without a shim is insufficient for some inherited commands. `GO_BINARY` may specify an absolute Go executable path for the core wrapper.

## Prepare the checkout

Use `main`, which includes the M1 baseline and M2 branding/local-workspace, credential-storage, discovery and explicit create/connect slices:

```powershell
git clone --branch main https://github.com/hoxsec/DiskPond.git
cd DiskPond
git submodule update --init --checkout apps/core
git -C apps/core rev-parse HEAD
pnpm install --frozen-lockfile
```

The engine gitlink is `0f31eefe409cb4f0571baf65abd7d063784598cd`, published on the owner-approved `hoxsec/diskpond-core` fork's `main`. It includes output cleanup after copy and ZIP finalization failures. The original upstream baseline remains recorded in [provenance](UPSTREAM.md). Do not use `git submodule update --remote` or substitute a globally installed Kopia binary. `pnpm build:core` checks the checkout against the recorded gitlink and marks modified core source with a `-dirty` build revision. The application starts core with `--managed-storage`, which the original baseline binary does not implement; build the pinned core.

The discovery compatibility fixture also builds the original baseline. In shallow checkouts, fetch that exact object before `pnpm smoke:discovery`, as CI does; this leaves the candidate checkout and gitlink unchanged:

```powershell
git -C apps/core fetch --no-tags --depth=1 origin e8955e7280edd9526b9f104f1592f233cfe6789b
```

Installation uses the pinned workspace lockfile and approved dependency build scripts. Retained hosted-service source packages still install their own dependencies; the desktop no longer imports their API/database contracts. Run installation once after intentional manifest changes, before starting parallel checks: pnpm 11 may auto-install on subsequent commands and concurrent installation can race on Windows shims. Regenerate the lockfile with pnpm rather than editing it manually.

Electron 42 exposes `install-electron`; its binary is not downloaded by this dependency's ordinary installation script. The dev/preview/smoke runners call it explicitly. To download it separately:

```powershell
pnpm --filter @blinkdisk/electron exec install-electron
```

First setup/build needs network access for package/Go modules, Electron and packager tools. Normal desktop startup needs no API or database service.

The create/connect slice adds a core initialization guard included in the published pin above. The owner-authorized source handoff advances the application gitlink to this exact revision. Local checks and clean Windows CI pass, including packaging, renderer create/connect, native recovery, development and installed smoke. See [create/connect evidence](docs/verification/m2-create-connect.md).

## Commands from the repository root

| Command | Behavior |
| --- | --- |
| `pnpm dev:desktop` | Builds the pinned native core and initial main/preload; starts Vite at `http://127.0.0.1:3002`, the main/preload compiler watcher and Electron. |
| `pnpm build:core` | Builds the native pinned engine with version/revision metadata and prints `--version`. Windows output: `apps/core/dist/kopia_windows_amd64/kopia.exe`. |
| `pnpm build:branding` | Regenerates desktop/favicons/tray artwork from the owner's SVGs. See [asset instructions](libs/assets/brand/README.md). |
| `pnpm build:desktop` | Rebuilds core, renderer, copied frontend and production main/preload. Type-checks the Electron package. |
| `pnpm preview:desktop` | Launches the existing build using `diskpondapp://frontend`; run `build:desktop` first. |
| `pnpm smoke:desktop` | Exercises the built renderer, preload, local onboarding and engine discovery in temporary app data. |
| `pnpm smoke:desktop --dev` | Runs that smoke through the actual `dev:desktop` wrapper, including server startup and cleanup. |
| `pnpm smoke:discovery` | Builds a clean baseline in a disposable core worktree; checks nonmutating discovery, native create/connect guards, legacy migration writes and restart recovery; restores/hashes baseline versions with both clients. Requires `build:core`; `DISKPOND_BASELINE_CORE` optionally selects an existing baseline executable. |
| `pnpm smoke:vaults` | Built-desktop keyboard create/connect flows, destination/password/duplicate errors, stale-discovery rejection, light/dark/zoom checks and three-vault restart. Injects only disposable native-picker results. Windows includes an isolated denied-ACL destination. |
| `pnpm smoke:restores` | Requires `build:desktop`. Exercises the native restore coordinator with real-engine hashes, keep-both/overwrite, denied/missing/junction destinations, cancellation/interruption and ZIP modes, then an isolated result-component keyboard/theme/zoom fixture. See [scope and full-volume blocker](docs/verification/m2-restore-outcomes.md). |
| `pnpm smoke:recovery` | Requires `build:desktop` and the installed Electron runtime. Two-vault/two-version renderer recovery, restart/tray lifecycle and missing-storage retry; compares hashes/entries/file mtimes and records initial timing/memory observations. Blocks remote Chromium/main-fetch requests. CI runs it under scoped OS firewall rules through `scripts/certify-m2-windows.ps1`, which also provisions a disposable full-volume VHD for `smoke:restores`. |
| `pnpm smoke:passwords` | Builds an isolated Electron test entry point and verifies native password protection, failure/session-only modes, wrong-password rejection, application restart and real-engine reconnect. Requires the existing pinned core build. |
| `pnpm smoke:providers` | Builds a credential-isolated loopback WebDAV service and Electron fixture; checks two-vault versioned snapshots/restores with hashes, protected/session/failure storage, restart, wrong/swapped credentials, both legacy migrations and credential scans. Requires Go and the matching managed-core build; no live-provider credentials. |
| `pnpm smoke:desktop --session-passwords` | Runs built desktop smoke with test-only unavailable secure storage, verifying the localized notice and password/settings IPC rejection. |
| `pnpm smoke:windows` | Installs the NSIS artifact into a disposable directory, checks installed startup/engine/resources and bundled-engine backup/restore hashes, quits and uninstalls. Validates the tag version when supplied. Requires a Windows user with no existing DiskPond installation/data/registration. |
| `pnpm build:windows` | Builds desktop/core, then invokes electron-builder's Windows NSIS target with `--publish never`. Outputs under `apps/electron/dist/`. |
| `pnpm lint:ci` | Whole imported application lint/format check; excludes generated routes, worker types and the Go submodule. |
| `pnpm types` / `pnpm types:desktop` | Type-checks desktop, Electron and inherited libraries with a `types` script. |
| `pnpm test` / `pnpm test:desktop` | Existing Electron, renderer, schema and utility Vitest suites. |
| `pnpm unused` | Whole-workspace dependency/export analysis, including inherited service sources. |

`pnpm dev` and `pnpm build` alias the desktop commands. They no longer launch the upstream hosted stack. Use the root packaging wrapper: the inherited package-level `build:windows` invokes the packager without building its inputs.

Renderer edits use Vite HMR. Main/preload edits recompile; quit and restart the dev command to load them. Development compilation replaces `apps/electron/build`; rebuild production before a later built smoke/preview or repackaging. **Quit** in the tray exits Electron and stops the development servers; closing the window keeps the inherited tray process alive. Ctrl+C stops the runner's process tree on Windows. A busy port 3002 is an error, rather than silently selecting another port.

## Isolated development and smoke checks

On the welcome screen select **Open DiskPond**. Existing local collections and preferences are preserved. Cached hosted-account collections stay on disk but are neither opened nor synchronized. Repository/recovery exercises use disposable sources and destinations.

The default development data root is `%APPDATA%\diskpond-dev`; packaged builds use `%APPDATA%\diskpond`. For an isolated unpackaged run:

```powershell
$env:DISKPOND_DATA_DIR = Join-Path $env:TEMP 'diskpond-local-fixture'
pnpm dev:desktop
Remove-Item Env:DISKPOND_DATA_DIR
```

The override must be absolute and is ignored in packaged builds. `DISKPOND_TEST_TMP` optionally sets the parent directory for smoke fixtures; it must already exist. The smoke runner deletes only the temporary directory it created. It blocks and fails on remote renderer HTTP(S) and main-process fetch requests, exercises keyboard onboarding, provider selection, settings/theme persistence and retired API rejection, and requires engine discovery to leave an empty disposable destination empty. Set `DISKPOND_SMOKE_CAPTURE_DIR` to retain screenshots. This assertion requires the [pinned owned-core discovery changes](docs/verification/m2-read-only-discovery.md); the unchanged upstream binary writes `.shards` and fails it. This smoke does not certify backup recovery or every network path.

Only packaged builds register the public DiskPond URI handler. Development/preview launches preserve any installed registration; Windows built/dev smoke checks compare its registry state before and after each run. Run the smoke commands sequentially in CI order: built, development, installed.

The password fixture uses three independent local repositories and per-vault engine caches under temporary application data, and scans those fixtures for plaintext/base64 passwords. It does not use the development profile or certify backup/restore. See [password-storage evidence](docs/verification/m2-password-storage.md). The provider fixture adds real versioned restore/hash comparisons, distinct WebDAV credentials and both legacy migrations. It scans fixture profiles/storage/caches/temp files and captured output; live Windows-locked files require a strict post-exit scan. See [provider-storage evidence and limits](docs/verification/m2-provider-storage-design.md). Key-store failure injection exists only in test entry points. The Windows workflow includes both fixtures and session-only built smoke before development/installed smoke; all passed in both published runs linked above.

`.env.template` documents the desktop defaults. Desktop builds no longer consume hosted API/cloud/web URLs or analytics keys. Auth, remote configuration sync, PostHog, LogSnag and Sentry execution have been removed from the desktop/main/preload dependency paths. Packaged update checks still use the DiskPond release feed; update preferences remain an M5 task.

## Windows packaging

`pnpm build:windows` is a development packaging command, with local version `0.0.0` when no release tag is supplied. Expected output is `apps/electron/dist/DiskPond-Windows.exe` plus `win-unpacked/`. It packages the engine, both project license texts and provenance record. GitHub publishing is disabled by the wrapper.

The unsigned `v0.1.0-alpha.1` prerelease is published with owner authorization. The inherited optional `CERTUM_*` signing variables remain available for future integration; the release workflow uses no certificate. Installer identity/feed metadata belongs to `hoxsec/DiskPond`. [Release instructions](docs/windows-release.md) describe tag-triggered checks, asset publication and source reproduction; [verification](docs/verification/windows-release-cicd.md) records passing release CI and downloaded checksums.

After building, `pnpm smoke:windows` exercises the installed artifact on a fresh test user/runner. It expects `0.0.0` for development, or the version in `GITHUB_REF_NAME` when `GITHUB_REF_TYPE=tag`. It temporarily registers installer/URI/startup entries, checks the installed executable via loopback debug connections, and uses the installed core CLI to create a disposable snapshot, delete its fixture source, restore and compare hashes/entries. This compact check reuses prior renderer recovery evidence; it does not certify upgrade/update flows. The inherited uninstaller leaves app-created startup/URI entries; the harness records that gap and removes only entries pointing to its own fixture. It refuses to replace an existing installation or data directory.

The local Windows 11 installed-startup check passes. Fresh-OS Windows 10/11 certification, upgrades, complete uninstall behavior, update preferences, signing and full notice/assets review remain M5 gates. macOS universal/lipo packaging and the Linux architecture/format matrix are M6; the native-core path mappings alone do not certify them.

## Core tests

M1 built the unchanged pinned engine and probed it through Electron. M2 adds [focused discovery/filesystem/format checks and real baseline restores](docs/verification/m2-read-only-discovery.md), plus [managed-connection/cache/bandwidth and credential-redaction checks](docs/verification/m2-provider-storage-design.md). These do not certify the entire core suite. Follow `apps/core/Makefile` before running broader suites: the `testing` build tag and `TESTING_ACTION_EXE` helper are required for relevant tests; provider suites also need their specific services/helpers.

The native Windows equivalent of the helper setup and default unit-test selection is shown below as an **unverified broader-suite recipe**, not an M1 passing result:

```powershell
Push-Location apps/core
go build -tags testing -o dist/testing_windows_amd64/testingaction.exe ./tests/testingaction
$env:TESTING_ACTION_EXE = Join-Path (Get-Location) 'dist/testing_windows_amd64/testingaction.exe'
go test -tags testing -count=1 -timeout 1200s -skip '^TestIndexBlobManagerStress$' ./...
Remove-Item Env:TESTING_ACTION_EXE
Pop-Location
```

Race-enabled runs need a working C toolchain; live providers, mount helpers and OS-specific integrations have separate prerequisites. For engine or recovery changes, use the requirement-specific real-repository checks in PLAN.md, not just mocked Vitest results.
