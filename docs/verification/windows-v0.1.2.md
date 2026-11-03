# Windows v0.1.2 — RustFS and SFTP storage reporting

Date: 2026-11-03. The owner authorized committing, pushing and publishing this release. **v0.1.2 is prepared; publication and downloaded-asset verification are pending.**

## Scope

- **F06 / P05 / DP04:** RustFS bucket-quota remaining capacity. [Focused verification](rustfs-quota.md).
- **F06 / P09:** SFTP statvfs destination available space with verified SSH host keys. [Focused verification](sftp-storage-space.md).
- Desktop/Electron version **0.1.2**, release notes and retained license texts for the new bundled storage dependencies.
- Core remains pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`; existing repository/credential formats and unsigned Windows x64 distribution remain intact.

## Verification

The feature records retain **81 focused tests**, native saved-connection/IPC checks, UI Light/Dark/200% review, types/lint/unused checks, builds and built-desktop smoke. Reuse this passing evidence; live provider validation and broad certification remain deferred.

Release-ready local checks (Windows x64, Node 24.14.0, pnpm 11.7.0):

- Frozen installation, lint (744 files), desktop/Electron/library type checks: passed.
- Full desktop-scoped unit suites: **712 tests across 63 files passed**.
- Launcher subprocess regressions: all four cases passed (five TAP tests including their parent).
- Release tag validation for `v0.1.2` and `git diff --check`: passed.
- Upstream application/core main still match the recorded baseline commits. Core checkout is clean and matches the pinned gitlink.

Commands used the cached pnpm launcher. Root type/test aliases could not resolve nested `pnpm` on this shell's PATH; their exact underlying workspace commands passed instead. The tag-triggered compact Windows build/installed recovery run will be recorded here. No live user backup repositories are used for verification.
