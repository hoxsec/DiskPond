# DiskPond — Contributor and Agent Instructions

## Purpose and current state

DiskPond is an AGPL-3.0 fork of BlinkDisk focused on account-free desktop backups to user-provided storage. It uses Electron/React/TypeScript and a pinned Kopia-derived Go sidecar. Windows is first; macOS and Linux are required later targets.

**Current repository state:** M1, M2 branding/local workspace, password/session-only storage, nonmutating discovery and owner-approved managed-provider storage/migration are merged into `main`. Integration branches retain the reviewed history. Both integration and merged-main Windows CI passed the credential/discovery slice, including packaging and installed smoke. Desktop account/cloud UI and auth/sync/telemetry paths are removed; retained service packages are outside the desktop runtime. The matching `hoxsec/diskpond-core` changes are published on core `main` and pinned at `aad67c688a05ce119859d49ca51bdf67787f0b99`; the original baseline remains recorded in `UPSTREAM.md`. Explicit create/connect behavior, truthful renderer restore outcomes and M2's desktop recovery gate remain open; `TODO.md` orders the next work. See `docs/verification/m1-windows-baseline.md`, `docs/verification/m2-branding-workspace.md`, `docs/verification/m2-password-storage.md`, `docs/verification/m2-read-only-discovery.md` and `docs/verification/m2-provider-storage-design.md`. Do not describe native fixture success as full desktop recovery or platform parity.

Read these documents before implementation:

1. [PLAN.md](PLAN.md) — confirmed decisions, pinned baseline, scope and parity IDs.
2. [ROADMAP.md](ROADMAP.md) — active milestone, dependencies and acceptance gates.
3. [STYLE.md](STYLE.md) — UI and code conventions.

Keep documentation status synchronized with actual implementation. Follow applicable nested contributor instructions when they are introduced; surface conflicts with the confirmed product decisions rather than silently changing scope.

## Product decisions to preserve

- Fork and reuse BlinkDisk; preserve its AGPL terms/notices and the core's separate Apache-2.0 terms/notices.
- No managed storage, subscriptions, billing, hosted login, or automatic configuration-sync service.
- Local workspace, manual repository connection, encrypted setup export/import, and compatible existing BlinkDisk BYO vaults.
- No analytics or automatic crash uploads. Diagnostics are local, redacted on export, and exported by user action.
- Original DiskPond identity, light/dark/system themes, and the calm utility design in STYLE.md.
- Preserve every applicable P/F requirement in PLAN.md. Record discoveries and unresolved compatibility gaps; do not silently reduce parity.

## Start-of-task workflow

1. Inspect repository status and relevant existing changes. Preserve user work and unrelated files.
2. Identify the active roadmap milestone and the requirement IDs for the task.
3. Inspect the corresponding upstream/inherited behavior and nearby implementation before editing.
4. Implement the smallest complete user-visible slice using existing abstractions.
5. Run checks appropriate to the changed behavior; report commands, results and actual blockers.
6. Update requirement evidence and milestone status when the acceptance criteria are met.

Ask when a decision changes product scope, on-disk/repository compatibility, cryptographic format, supported platforms, or release ownership. Routine implementation details should follow the documented defaults. Use subagents only when explicitly requested by the user or applicable instructions.

## Fork import and upstream handling

- Application baseline: `blinkdisk/blinkdisk@e435469b3d09b8c217417d1325331865e483ce2f`.
- Core baseline: `blinkdisk/core@e8955e7280edd9526b9f104f1592f233cfe6789b`.
- Import through a reviewable integration branch while preserving current repository history and planning documents. Reconcile incoming contributor files rather than replacing these instructions blindly.
- Pin the exact core gitlink and dependency lockfile. Do not substitute a moving branch or a stock Kopia binary without compatibility evidence.
- Keep rebranding, service extraction, feature changes and engine changes separately reviewable.
- Preserve copyright/license/NOTICE material and record changed upstream code. Publish corresponding source/build instructions with distributions.
- Namespace application IDs, URI scheme, data/cache directories, startup entry, artifacts and release feed under DiskPond.
- Published upstream-scoped packages are external dependencies unless explicitly forked. Do not mass-rename package imports into nonexistent packages.

## Architecture boundaries

Current inherited locations:

| Location | Responsibility |
| --- | --- |
| `apps/desktop` | React screens, presentation state, TanStack queries/forms/router. |
| `apps/electron` | Main/preload, validated IPC, native dialogs, process supervision, secrets, persistence, restore coordination, updates. |
| `apps/core` | Pinned Go backup engine: repository format, encryption, snapshots, policies, retention and storage adapters. |
| `libs/schemas` | Shared runtime-validated contracts and domain types. |
| `libs/ui`, `libs/components`, `libs/forms` | Reusable UI and form behavior. |
| `libs/styles`, `libs/assets`, `locales/en` | Tokens, fonts/assets and translated copy. |
| `docs/verification` | Reproducible acceptance evidence introduced during implementation. |

- Keep filesystem, secrets, arbitrary process execution and engine credentials out of renderer code.
- Expose narrow named preload methods; validate IPC payloads and sender/context in main. Do not expand generic arbitrary-key or arbitrary-command bridges.
- Keep the engine loopback-only, authenticated and supervised. Treat engine version/API changes as integration changes.
- Keep the engine authoritative for backup state and scheduling. Avoid a second scheduler or policy engine in React.
- Use existing file-backed persistence initially. Extract cloud database/API type dependencies into shared contracts; do not add a desktop PostgreSQL requirement.
- Preserve supported policy fields that the current editor does not display. Distinguish omitted, inherited, false, zero and empty values.

## Backup and restore correctness

- Use disposable fixtures and isolated destinations for development/integration tests, never the developer's real backup repositories.
- Distinguish creating a repository from connecting to one. Discovery must not initialize over existing data or trigger format upgrades/maintenance.
- A successful operation must represent a confirmed terminal outcome. Partial, canceled, unavailable and failed states are not success.
- Retain keep-both versus overwrite semantics explicitly; validate destination containment and symlink/junction behavior in native code boundaries.
- Never delete original source files through backup-management actions. Clearly distinguish disconnecting a vault from deleting stored snapshots.
- Preserve pinned snapshots and verify retention/cleanup behavior after policy changes.
- Test interrupted operations and restart/reconnect behavior when modifying job lifecycle, persistence or engine supervision.
- Do not invent repository encryption or chunking. Setup-export encryption is a separate versioned, authenticated format using maintained primitives.
- Persist secrets only through a working OS-protected mechanism; otherwise use session-only values. No silent plaintext fallback.
- Redact credentials/tokens/passwords from logs/errors. Redact personal paths and identifiers from exported diagnostics by default.
- Preserve TLS and host-key verification defaults. Per-provider insecure settings are explicit connection options.

## Code conventions

- Follow STYLE.md and the surrounding implementation. Retain the existing workspace layout and tools.
- TypeScript strict mode; runtime validation at external boundaries; no unchecked `any` or broad type assertions to silence contract mismatches.
- Existing `Z...` Zod schema names and inferred `Z...Type` types may be retained for merge consistency.
- Kebab-case source filenames; PascalCase React components/types; camelCase functions/hooks; named exports by default. Keep framework-required export forms.
- Use package exports for cross-package imports. App-local aliases must not cross into another app's private internals.
- Keep UI copy in locale files and visual decisions in shared semantic tokens.
- Do not manually edit generated route trees, generated worker types, compiled assets or dependency lockfile internals.
- Keep native path handling platform-aware; do not concatenate Windows/Unix separators in shared logic.
- Use bounded/cancelable asynchronous work and clear error types. Do not turn errors into empty success results.
- Avoid unrelated formatting sweeps, framework migrations and broad dependency updates during parity work.

## Commands and verification

Use Node 24.15.0 (`.nvmrc`), pnpm 11.7.0 and Go 1.25.5 as documented in DEVELOPMENT.md. The local baseline also passed on the minimum Node 24.14.0. The root defaults are desktop-scoped; package-level Electron packaging commands do not build their inputs. Install once after manifest changes before running concurrent checks, because pnpm 11 can otherwise race automatic installation on Windows.

| Command | Current use |
| --- | --- |
| `pnpm install --frozen-lockfile` | Reproduce the pinned workspace. |
| `pnpm lint:ci` | Check formatting/lint without rewriting files. |
| `pnpm types` | Desktop/Electron/library type checking (`types:desktop`). |
| `pnpm test` | Electron/desktop/schema/utility Vitest suites (`test:desktop`); scope to affected packages during normal development. |
| `pnpm unused` | Dependency/export checks after extraction or package changes. |
| `pnpm dev:desktop` | Renderer + main/compiler; builds the pinned engine, started on demand. No hosted service requirements for the local path. |
| `pnpm build:core` | Build the pinned native engine into expected resource paths; validates checkout against gitlink. |
| `pnpm build:branding` | Generate native/favicons/tray assets from the owner's canonical SVGs. |
| `pnpm build:desktop` | Core + renderer/main/preload and copied frontend. |
| `pnpm smoke:desktop` | Built-app onboarding/IPC/engine probe using temporary settings and an empty destination. |
| `pnpm smoke:desktop --dev` | Exercise the actual development wrapper and its process cleanup. |
| `pnpm smoke:discovery` | Isolated nonmutating discovery through Electron and two-version baseline-copy restore/hash checks; requires the candidate core build. |
| `pnpm smoke:passwords` | Isolated native password protection/failure/restart and real-engine reconnect checks; uses the existing pinned core build. |
| `pnpm smoke:providers` | Credential-isolated loopback WebDAV, two-vault versioned restore/hash checks, protected/session/failure modes, legacy migration and live/post-exit credential scans; requires Go and the matching managed-core build. |
| `pnpm smoke:desktop --session-passwords` | Built-app session-only notice and IPC rejection checks with test-only secure-storage failure injection. |
| `pnpm build:windows` | Desktop/core/resources plus NSIS packaging; publishing disabled. |
| `pnpm smoke:windows` | Install/start/probe/quit/uninstall a disposable development artifact; requires a Windows user without existing DiskPond data/install/registration. Records inherited uninstall leftovers and cleans only its fixture. |

Keep this table synchronized with verified commands. `pnpm build` aliases `build:desktop`, not the installer. Core test commands depend on build tags and helper binaries; follow its pinned Makefile and DEVELOPMENT.md. The whole core/provider suite has not been certified by M1.

### Choose checks by impact

- Documentation/copy/token-only edits: review relevant links, wording, rendering and accessibility. Do not add tests that merely mirror static text or styles.
- UI logic: focused unit/component tests and the affected keyboard/interaction flow.
- Provider/policy/migration/IPC/crypto changes: focused regression and integration tests, including relevant failures and round-trips.
- Backup/restore/retention/engine changes: real-engine recovery/hash verification and relevant interruption/compatibility fixtures.
- Packaging/update/platform changes: installed-artifact checks on the affected OS/architecture.

Run the required checks once the implementation is ready. Broaden or repeat when new changes, failures or unresolved concerns justify it. CI/provider credentials/hardware being unavailable must be reported as a blocker, not as a passing check.

## Completion and handoff

An implementation task is complete when its user-visible behavior, appropriate checks, localization, error/empty states and required evidence are present. Update ROADMAP.md only when its gate actually passes.

Summarize: what changed, affected requirement IDs, checks/results, and concrete remaining blockers. Never claim full parity based on the feature list alone. Do not commit, push, tag or publish unless the user requested that action.
