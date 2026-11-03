# Windows v0.1.1 — vault storage and Activity improvements

Date: 2026-11-03. The owner authorized committing/pushing the reviewed batch and publishing a new release. **v0.1.1** is the next stable Windows x64 patch release; publication and downloaded-asset verification are pending.

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

The tag-triggered Windows workflow will verify packaging and installed recovery. Published assets must be downloaded and matched against SHA256SUMS.txt and the update metadata before closing this record.

## Publication

Pending commit, annotated tag, Windows CI and GitHub publication. The existing `release.yml` workflow publishes only after its compact check, including NSIS packaging and installed bundled-engine backup/restore hashes, passes.
