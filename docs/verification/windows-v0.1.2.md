# Windows v0.1.2 — RustFS and SFTP storage reporting

Date: 2026-11-03. The owner authorized committing, pushing and publishing this release. **[v0.1.2](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.2)** is published as GitHub Latest for Windows x64; release CI and downloaded-asset verification passed.

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

Commands used the cached pnpm launcher. Root type/test aliases could not resolve nested `pnpm` on this shell's PATH; their exact underlying workspace commands passed instead. The tag-triggered compact Windows build/installed recovery run also passed. No live user backup repositories are used for verification.

## Publication

Committed the batch as `1ca046aef8ebe090b987fb1e2c84b1f20651a644` and pushed `main` with annotated tag `v0.1.2` atomically to `hoxsec/DiskPond`.

[Release CI 41728398483](https://github.com/hoxsec/DiskPond/actions/runs/41728398483) passed frozen install, lint, types, unit/launcher tests, pinned-core/NSIS build, installed startup and bundled-engine backup/restore hash smoke, asset assembly and publication. Duplicate main-branch check `41728398269` was canceled in favor of the same compact release check.

GitHub's `/releases/latest` API confirms **v0.1.2**, `draft: false`, `prerelease: false`, published at `2026-11-03T22:17:11Z`, with 11 assets.

Downloaded every asset with `gh release download v0.1.2 --repo hoxsec/DiskPond` into `%LOCALAPPDATA%/Temp/opencode/diskpond-v0.1.2-downloads-1ca046a`. All **10 SHA-256 entries** match. The downloaded `latest.yml` contains version `0.1.2`, and its SHA-512 matches the installer. Installer SHA-256: `727653b49bae830adbae6a2a697911d8ec92e89e45fb62e1f65bb960257b35cf`.

The release tag stays on `1ca046a`; a documentation-only follow-up records verified publication. The installer remains unsigned. Live RustFS/SFTP, other-platform and upgrade matrices remain deferred under D13.
