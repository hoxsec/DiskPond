# Windows v0.1.1 — vault storage and Activity improvements

Date: 2026-11-03. The owner authorized committing/pushing the reviewed batch and publishing a new release. **[v0.1.1](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.1)** is published as GitHub Latest for Windows x64; release CI and downloaded-asset verification passed.

## Scope

- **F06 / P01–P03 / DP04:** vault available-space card, including explicit zero, unavailable and unsupported states, native-owned destination reads and 30-second/return refresh. [Focused evidence](vault-storage-space.md).
- **D14 / DP06 / DP04:** compact, individually expandable Activity backup/issue rows with keyboard navigation and full details. [Focused evidence](activity-compact-rows.md).
- **D13:** standalone Windows pnpm launcher and nested-invocation fix, with subprocess regression coverage added to the compact Windows workflow. [Focused evidence](desktop-pnpm-launcher.md).
- Desktop/Electron package version **0.1.1**, public release notes and current user documentation.
- Core remains pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`. Existing repository/encryption formats and unsigned distribution are retained.

## Verification

The feature records above retain local build, native create/connect/restart, Activity/overview keyboard/theme/200% and development-wrapper evidence. These passing checks were reused for this release batch.

Final local checks on Windows x64, Node 24.14.0 and pnpm 11.7.0:

- `pnpm install --frozen-lockfile`: passed; lockfile unchanged after the two package version bumps.
- `pnpm lint:ci`: passed, 740 files checked.
- `pnpm types:desktop`: passed for desktop, Electron and libraries.
- `pnpm test:desktop`: **670 tests across 61 files passed**.
- `node --test scripts/lib/process.test.mjs`: all four subprocess cases passed (five TAP tests including their parent).
- `scripts/release-assets.ps1 -ValidateOnly` with `v0.1.1`: passed.
- `git diff --check` and all 102 local links in 14 changed Markdown documents: passed.
- Upstream application/core `main` still match their recorded baseline commits; no new upstream changes were found to integrate. The core checkout matches the application gitlink.

The tag-triggered Windows workflow also passed packaging and installed recovery, followed by downloaded-asset checks below.

## Publication

Committed the batch as `a3a4647eaa7cb7b88ed7f97a52c49895122f7183` and pushed `main` with annotated tag `v0.1.1` atomically to `hoxsec/DiskPond`.

[Release CI 41717257033](https://github.com/hoxsec/DiskPond/actions/runs/41717257033) passed: frozen install, lint, desktop/Electron/library types, unit and launcher regressions, pinned-core/NSIS build, installed startup and bundled-engine backup/restore hashes, asset assembly and publication. The duplicate main-branch check `41717257606` was canceled in favor of the same compact check within the release workflow.

GitHub's `/releases/latest` API confirms **v0.1.1**, `draft: false`, `prerelease: false`, published at `2026-11-03T21:04:03Z`, with 11 assets.

Downloaded every release asset with `gh release download v0.1.1 --repo hoxsec/DiskPond` into `%LOCALAPPDATA%/Temp/opencode/diskpond-v0.1.1-downloads-a3a4647`. All **10 SHA-256 entries** match, including the installer, blockmap, update metadata, both source ZIPs and license/build records. The downloaded `latest.yml` contains version `0.1.1`, and its SHA-512 matches the downloaded installer.

The release tag stays on `a3a4647`; a documentation-only follow-up records verified publication. The installer remains unsigned. Live-provider/USB/NAS, other-platform and upgrade matrices remain deferred under D13.
