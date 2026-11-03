# Windows v0.1.4 — In-app updates

Date: 2026-11-04. The owner authorized committing, pushing and publishing the updater batch. This candidate continues that release after the [unpublished v0.1.3 fixture failure](windows-v0.1.3.md). Publication and downloaded checksums are pending.

## Scope and checks

- **F25:** in-app downloads, idle-only explicit restart/install, release notes, cancellation/retry, size/speed, 24-hour reminders and the latest 50 local update attempts. [Feature evidence](in-app-updates.md).
- Desktop/Electron version **0.1.4**. Core stays pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`; repository/credential formats and unsigned Windows x64 distribution remain intact.
- Reuse v0.1.3's passing local/CI 739 tests across 65 files, types/lint, builds and installed v0.1.2-to-candidate replacement/preferences/initial recovery hashes. Feature UI and 32-file recovery evidence is retained in the feature record.
- The installed updater fixture now removes only its own NSIS-created updater cache before download. Its preflight refuses users with existing installation/data/registrations/cache. Native download/checksum, installer handoff/relaunch, truthful unconfirmed synthetic-version history and post-update recovery remain required.
- The developer's existing Windows installation is preserved; installed tests run on a clean GitHub Windows runner.
- Correction checks passed locally: frozen install, lint (756 files), v0.1.4 tag validation and `git diff --check`. The real electron-updater download probe also passed with a pre-seeded fixture `installer.exe` cache, proving the correction forces an installer HTTP transfer; installation remained stubbed. Evidence directory: `%LOCALAPPDATA%/Temp/opencode/diskpond-native-download-bH5UXj`.

## Publication

Pending commit/tag, corrected compact Windows release run, publication and downloaded checksums. v0.1.3's failed tag remains immutable and has no published release. Existing v0.1.2 users need one manual installer update to receive the in-app updater.
