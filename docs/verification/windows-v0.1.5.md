# Windows v0.1.5 — Website and installer isolation

Date: 2026-11-04. The owner authorized a new branch, commit/push, merge and release for the website and screenshot batch, with an explicit requirement to exclude website files from the Windows installer. **[v0.1.5](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.5) is published as GitHub Latest.** Release CI, installed-package/upgrade/updater/recovery checks and downloaded-asset verification passed.

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

Release CI passed on the first attempt: frozen install, lint, desktop types, **739 tests across 65 files**, five launcher tests, Windows packaging, installed checks, asset assembly and publication. Installed execution used the clean GitHub Windows runner; the developer's existing installation was preserved.

The installed CI artifact contains **235 ASAR entries**, with only the expected desktop roots/resources and no website files. The local build's 236-entry inventory is separate evidence, not the published artifact's count. Checksum-pinned v0.1.2-to-v0.1.5 replacement retained preferences. Native updater download/checksum, NSIS handoff/relaunch, settings retention and post-update recovery hashes passed. The synthetic `99.0.0` update offer correctly remained unconfirmed after relaunching the actual `0.1.5` installer; exhaustive public-feed upgrade matrices remain deferred. Fixture uninstall/cleanup completed, including inherited startup/URI leftovers.

## Publication

Pushed branch `release/v0.1.5-website` at `f593f4d1054cfa5d05aed01708abb363bcb71636`, then merged and pushed `main` at `b2ea647b04c293bc0e503fa46a228dee9dcdf04f`. Annotated tag **v0.1.5** points to the merged branch's release commit; its tree is identical to the merge commit. The merge skips a duplicate CI run; [tag release CI 41749368604](https://github.com/hoxsec/DiskPond/actions/runs/41749368604) performs the final compact check and publication.

GitHub's `/releases/latest` API confirms **v0.1.5**, `draft: false`, `prerelease: false`, published at `2026-11-04T00:53:29Z`, with **11 assets**.

Downloaded all assets with `gh release download v0.1.5 --repo hoxsec/DiskPond` into `%LOCALAPPDATA%/Temp/opencode/diskpond-v0.1.5-downloads-f593f4d`. All **10 SHA-256 entries** match. Both downloaded updater SHA-512 entries and the **118,436,863-byte** installer size match; metadata version is `0.1.5`. Release-note application/core references match the tag and core pin. The application source ZIP contains the website source, locale and screenshots, and package version 0.1.5. Machine-readable evidence is retained as `verification.json` in the download directory.

Installer SHA-256: `3c5c26c13a33488668c16636907870930d786fe203d561cde1a83782c033b3d2`.

The release tag stays on `f593f4d`; a documentation-only follow-up records verified publication. Website deployment/DNS, checkout and managed-storage provisioning remain separate pending work. The installer remains unsigned; deferred provider/platform certification is unchanged.
