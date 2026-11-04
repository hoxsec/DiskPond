# Windows v0.1.5 — Website and installer isolation

Date: 2026-11-04. The owner authorized a new branch, commit/push, merge and release for the website and screenshot batch, with an explicit requirement to exclude website files from the Windows installer. **Publication is in progress; v0.1.4 remains the latest published release.**

## Scope and evidence

- **D16 / WEB01 / DP04:** prelaunch website, pricing/enquiry/download/guides, nine real app views in both themes and all 11 storage connections. [Website verification](website.md).
- **F26:** actual installed-package inspection checks that the ASAR contains only `build`, `frontend` and `package.json`; resource roots contain native assets, binaries, licenses and updater files. Website source/output, screenshots and `website.json` are excluded.
- Desktop version **0.1.5**. Core stays pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`. The Windows x64 installer remains unsigned.
- Fresh v0.1.5 package inspection found 236 ASAR entries, only the three desktop roots, and no marketing/website/Astro/screenshot paths. The renderer copies an explicit list of 15 desktop locales, excluding the website locale. The new inventory assertion also passed against this archive using Electron's actual ASAR filesystem support in an isolated local probe.
- Reuse passing website build/types/lint and browser evidence: 12 routes, 69 links/assets/anchors, nine theme-paired image views, keyboard/lightbox/focus, responsive layouts and no automatic remote requests. Fresh app capture passed with four sources and five real snapshots.

## Release checks

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; lockfile unchanged. |
| `pnpm build:windows` with tag `v0.1.5` | Passed on Windows x64, Node 24.14.0, pnpm 11.7.0 and Go 1.25.5. |
| Fresh packaged ASAR/resources | Passed: version 0.1.5, 236 ASAR entries, desktop-only roots/resources, required entrypoints present and website files absent. The exact new inventory assertion passed in an isolated Electron probe. |
| Local updater metadata | Version 0.1.5 and SHA-512 match the freshly built 118,788,581-byte installer. |
| `pnpm lint:ci` | Passed across 781 files. |
| `scripts/release-assets.ps1 -ValidateOnly` / `git diff --check` | Passed. |

The first local Windows build could not find Go (`spawn go ENOENT`). Adding the existing Go installation to PATH and explicitly selecting `GOTOOLCHAIN=go1.25.5` resolved it; the complete rerun passed.

Pending: final release CI, installed upgrade/updater/recovery, publication and downloaded-asset checksums. Installed execution uses the clean GitHub Windows runner; the developer's existing installation is preserved.

## Publication

Branch: `release/v0.1.5-website`. Commit, merge, tag and release results will be recorded after completion. Website deployment/DNS, checkout and managed-storage provisioning remain separate pending work.
