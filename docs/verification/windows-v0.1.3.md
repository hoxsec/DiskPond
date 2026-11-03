# Windows v0.1.3 — In-app updates

Date: 2026-11-04. The owner authorized committing, pushing and publishing the updater batch. **This candidate was not published.** Its installed-updater fixture failed; [v0.1.4](windows-v0.1.4.md) carries the fixture correction without moving the v0.1.3 tag.

## Scope

- **F25:** in-app download and explicit restart/install, with native activity guards, progress/size/speed, cancellation/retry, release notes, 24-hour reminders and the latest 50 local update attempts. [Feature evidence](in-app-updates.md).
- Desktop/Electron version **0.1.3**, public release notes and updated installation/update instructions.
- Core stays pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`. Existing repository/credential formats and unsigned Windows x64 distribution remain intact.

## Verification

Reuse the feature record's passing 357 Electron tests, types/lint, renderer/main builds, keyboard/UI checks, built-desktop smoke and 32 real-engine restored file hashes.

Release-ready local checks (Windows, Node 24.14.0, pnpm 11.7.0):

- `pnpm install --frozen-lockfile`, `pnpm lint:ci` (756 files), `pnpm types:desktop`: passed.
- `pnpm test:desktop`: **739 tests across 65 files passed**.
- `node --test scripts/lib/process.test.mjs`: five TAP tests passed.
- v0.1.3 release-tag validation and `git diff --check`: passed.
- A disposable Electron probe ran the production updater and real electron-updater through the new installed-test feed routing, downloading and verifying the previously checksum-verified v0.1.2 installer. Installation was stubbed to protect the developer's existing installation. Evidence directory: `%LOCALAPPDATA%/Temp/opencode/diskpond-native-download-r6n4Mj`.
- Upstream application/core main still match the recorded baselines; the owned core checkout is clean and matches the pinned gitlink.

The compact Windows release run now also installs checksum-pinned public v0.1.2 before replacing it with the candidate and checking retained preferences. It exercises the candidate's actual updater with test-only loopback feed routing through the inspector: a synthetic newer version points at the real candidate installer/checksum. Native download, NSIS handoff/relaunch, retained settings and a post-update recovery hash are required. Since the offered fixture version deliberately differs from the installed version, history must report **Installation not confirmed** rather than false success. Production updater URLs/IPC are unchanged by the fixture. A matching-version relaunch has focused unit coverage; exhaustive public-feed version-to-version matrices remain deferred.

This test requires an isolated Windows user with no existing DiskPond installation, data, registrations or updater cache. The developer's current user already has DiskPond installed; the installed check runs on the clean GitHub Windows runner.

## Publication

Committed/pushed as `d12d8e67056cbd2b7278a49dbfa69aed18037301` with annotated tag v0.1.3. [Release CI 41737661936](https://github.com/hoxsec/DiskPond/actions/runs/41737661936) passed frozen install, lint, types, all unit/launcher tests and Windows packaging. The installed check passed v0.1.2-to-candidate replacement, retained preferences and initial bundled-engine backup/restore hashes, then failed `The real installer must be downloaded`.

The fixture offers the just-installed candidate's bytes under a synthetic newer version. NSIS cached those same bytes (`app-builder-lib/templates/nsis/include/installer.nsh`), allowing native updater cache/differential reuse without an installer HTTP request. v0.1.4 clears only the fixture-created updater cache before download, retaining the assertion. Publication was skipped; no assets were published and GitHub Latest stayed v0.1.2. Duplicate main check 41737661998 was canceled in favor of the release check. Existing v0.1.2 users need one manual installer update to receive the in-app updater.
