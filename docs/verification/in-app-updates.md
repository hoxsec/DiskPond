# In-app updates — F25

Date: 2026-11-03; publication verified 2026-11-04. Released with owner authorization in **v0.1.4**, now GitHub Latest. Windows release CI, installed-updater checks and downloaded checksums passed. [Release record](windows-v0.1.4.md).

The owner's in-app update request supersedes the notification-only behavior recorded in [update-banner.md](update-banner.md).

## Behavior

- The sidebar banner and Settings use the same **Download update** action, download percentage, transferred/total size and speed, cancellation, retry error and **Restart and install** action.
- Installation is offered only after native activity reads report idle, and is rechecked on click. Active/canceling tasks, pending/uploads, imminent scheduled work, native restore reservations, startup and unknown/error states block installation. Read-only checks cover every managed vault and repeat while an installer is ready. Work becoming idle enables the button; it does not restart the app automatically.
- **What's new** shows release-body text from the same discovered release, capped at 32,000 characters. HTML/Markdown remains plain text; notes cannot execute scripts or fetch remote images. Missing notes have an explicit empty state.
- **Remind me later** suppresses that version's sidebar banner for 24 hours across restarts; Settings remains available. A newer release is not suppressed. Manual checks/downloads clear the reminder; expiry restores the banner.
- **Update history** shows the installed version and the latest 50 attempts in Settings. The existing settings store persists only version identifiers, timestamps, attempt IDs and outcomes, plus the reminder. Renderer IPC cannot write history directly. Startup converts interrupted downloads and unconfirmed installs into explicit outcomes, and marks an installation successful only when the running packaged version equals the requested target.
- Discovery still validates DiskPond's release version against its `latest.yml`; stable installations exclude prereleases. Automatic checks retain their opt-out. Development checks remain read-only.
- Installed Windows builds use the existing `electron-updater` dependency, with a feed pinned to the discovered DiskPond release tag. Native metadata must match the offered version before download. The library verifies installer checksums.
- Download requests are deduplicated. Discovery cannot replace an active download or ready installer. Downloads have a 15-minute cancellation deadline; failed and canceled downloads remain retryable. Cancellation during native metadata discovery is honored before binary download; late progress/completion cannot turn cancellation into readiness.
- No automatic download or install-on-quit. Installation is permitted only after download completes; installer launch errors remain visible and retryable. The existing app quit path stops vault sidecars.
- Narrow main-window-only IPC exposes download/install/cancel/remind without accepting renderer URLs, installer paths or history payloads. Updater logs are disabled to avoid exposing signed URLs/local paths.

## Local checks

Environment: Windows, Node 24.14.0, repository-managed pnpm (added `%LOCALAPPDATA%\pnpm\bin` to PATH for commands).

- `pnpm types`: passed.
- `pnpm lint:ci` and `git diff --check`: passed.
- `pnpm --filter @blinkdisk/electron exec vitest run`: 27 files / 357 tests passed. Updater/history/activity cases cover discovery/opt-out, explicit downloads, metadata mismatch, cancellation before and during transfer, deadline/failure/retry, progress, install-time idle rechecks, restore/startup/unknown activity, reminders across restart/expiry/manual check, bounded history and installed-version reconciliation. Storage-write failures keep installation retryable without quitting.
- `pnpm --filter @blinkdisk/desktop build` and `pnpm --filter @blinkdisk/electron compile:prod`: passed.
- `node scripts/smoke-update-ui.mjs`: passed keyboard retry/cancel/download details/release notes/history/reminder/idle-only install, inert script text and Light/Dark 200% overflow checks with real components and fixture IPC. Latest renderer CSS and screenshots: `C:\Users\HOXSEC\AppData\Local\Temp\opencode\diskpond-update-ui-GzcHkE`. No installer executes.
- `node scripts/smoke-update-activity.mjs`: passed with core `0f31eefe409cb4f0571baf65abd7d063784598cd`. A live backup and native restore each blocked installation, both returned to idle, and all 32 restored file hashes matched. Evidence: `C:\Users\HOXSEC\AppData\Local\Temp\opencode\diskpond-update-activity-MuODVP\result.json`.
- `node scripts/smoke-update-banner.mjs`: passed actual sidebar visibility/version/keyboard download/failure/retry and Settings manual-check spinner/current-version/error/retry/availability checks with fixture IPC.
- `node scripts/copy-frontend.mjs` followed by `pnpm smoke:desktop`: passed current built-app onboarding, provider flow, settings/theme persistence, retired IPC rejection and engine discovery with no remote renderer/main-fetch requests. Expected rejected-request errors were logged by the negative IPC checks.

Fixture development exposed missing optional SSH native-addon exclusions/ESM `__dirname`, Electron readiness blocked by top-level await, and a missing empty restore destination. The fixture now uses the production bundling exclusions, asynchronous ready callback and an explicitly created disposable destination. The passing run above supersedes these fixture-only failures.

## Installed release verification

The compact Windows release check passed checksum-pinned v0.1.2-to-v0.1.4 installer replacement and the actual native updater's download/checksum, NSIS handoff/relaunch, retained settings and post-update recovery hash. Test-only inspector routing offers the real candidate installer as synthetic version `99.0.0`; the actual `0.1.4` relaunch correctly records **NOT_INSTALLED**. Matching-version confirmation is covered by focused unit tests. [Release CI 41738718581, attempt 2](https://github.com/hoxsec/DiskPond/actions/runs/41738718581) passed all 739 desktop-scoped tests and published v0.1.4; all 10 downloaded asset checksums passed afterward.

The release record preserves v0.1.3's corrected fixture cache failure and v0.1.4's non-reproducing first-attempt worker exit. Installed tests used a clean Windows runner. Existing v0.1.2 installations need one manual installer update to receive this updater. Exhaustive public-feed version-to-version matrices remain deferred.
