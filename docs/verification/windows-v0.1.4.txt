# Windows v0.1.4 — In-app updates

Date: 2026-11-04. The owner authorized committing, pushing and publishing the updater batch. **[v0.1.4](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.4)** is published as GitHub Latest for Windows x64 after the [unpublished v0.1.3 fixture failure](windows-v0.1.3.md). Release CI, installed-updater checks and downloaded-asset verification passed.

## Scope and checks

- **F25:** in-app downloads, idle-only explicit restart/install, release notes, cancellation/retry, size/speed, 24-hour reminders and the latest 50 local update attempts. [Feature evidence](in-app-updates.md).
- Desktop/Electron version **0.1.4**. Core stays pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`; repository/credential formats and unsigned Windows x64 distribution remain intact.
- Reuse v0.1.3's passing local/CI 739 tests across 65 files, types/lint, builds and installed v0.1.2-to-candidate replacement/preferences/initial recovery hashes. Feature UI and 32-file recovery evidence is retained in the feature record.
- The installed updater fixture now removes only its own NSIS-created updater cache before download. Its preflight refuses users with existing installation/data/registrations/cache. Native download/checksum, installer handoff/relaunch, truthful unconfirmed synthetic-version history and post-update recovery passed in release CI.
- The developer's existing Windows installation is preserved; installed tests run on a clean GitHub Windows runner.
- Correction checks passed locally: frozen install, lint (756 files), v0.1.4 tag validation and `git diff --check`. The real electron-updater download probe also passed with a pre-seeded fixture `installer.exe` cache, proving the correction forces an installer HTTP transfer; installation remained stubbed. Evidence directory: `%LOCALAPPDATA%/Temp/opencode/diskpond-native-download-bH5UXj`.

## Publication

Committed/pushed as `6c887770728d956bc260801bf3ca0b8134736e60` with annotated tag **v0.1.4**. [Release CI 41738718581](https://github.com/hoxsec/DiskPond/actions/runs/41738718581) attempt 1 passed frozen install, lint and types, then lost a Vitest fork worker during the unchanged SFTP suite. Electron reported 26/27 files and 340/357 tests passed with `Worker exited unexpectedly`; no failed assertion was reported. Packaging/publication were skipped. The missing `src/sftp-storage-space.test.ts` passed all 17 tests locally on investigation. Duplicate main check `41738719622` was canceled in favor of the release check.

**Attempt 2 passed on the unchanged tag:** frozen install, lint, types, **739 tests across 65 files**, five launcher TAP tests, pinned-core/NSIS build, installed upgrade/updater/recovery, asset assembly and publication. The worker exit did not recur; its cause was not established.

The installed check replaced checksum-pinned v0.1.2 with v0.1.4 and retained preferences. The actual native updater downloaded and verified the candidate installer through the loopback fixture, handed off to NSIS, relaunched, retained settings and restored a prior backup with a matching hash. Its synthetic `99.0.0` offer deliberately differs from the real `0.1.4` installer, so the relaunch correctly recorded **NOT_INSTALLED**, not false installed-version success. Matching-version reconciliation has focused unit coverage; public-feed version-to-version matrices remain deferred. The fixture uninstalled and removed its data, including inherited startup/URI leftovers that still require fixture cleanup.

GitHub's `/releases/latest` API confirms **v0.1.4**, `draft: false`, `prerelease: false`, published at `2026-11-03T23:34:02Z`, with **11 assets**.

Downloaded every asset with `gh release download v0.1.4 --repo hoxsec/DiskPond` into `%LOCALAPPDATA%/Temp/opencode/diskpond-v0.1.4-downloads-6c88777`. All **10 SHA-256 entries** match. The downloaded `latest.yml` contains version `0.1.4`; both SHA-512 entries and its **118,436,499-byte** size match the installer. Release-note application/core source references match the pinned commits. Installer SHA-256: `002383c520383b04b2d219c34946f733c59a1779437d45d099b8ea393403bc20`.

The release tag stays on `6c88777`; a documentation-only follow-up records verified publication. v0.1.3's failed tag has no published release. Existing v0.1.2 users need one manual installer update to receive the in-app updater. The installer remains unsigned; live-provider, other-platform and exhaustive upgrade certification remain deferred under D13.
