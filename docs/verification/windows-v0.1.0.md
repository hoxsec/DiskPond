# Windows v0.1.0 — first stable public release

Date: 2026-11-03. The owner authorized fixing the comparison label, committing/pushing the existing work and publishing the first stable public release, with README screenshots/features and repository cleanup (D15).

## Scope

- DP05: explicitly load `history` translations in the backup-history toolbar and snapshot menu. The lazy namespace previously rendered `comparison.title` until Activity/comparison had been visited.
- F25: include commit `8a85153`, the GitHub release banner and manual Settings check. [Existing focused evidence](update-banner.md).
- DP04: product-facing README, three real built-app screenshots, features, download and recovery links. The capture runner uses a disposable drive/profile/repository, demo identity and real snapshots.
- Release metadata: application version `0.1.0`; stable tags become GitHub Latest, while alpha/beta/rc tags remain prereleases. Public notes are in `docs/releases/v0.1.0.md`.
- Cleanup: remove unused root Docker service setup, empty sponsorship config and redundant environment template; consolidate contradictory active release-status prose. Retain source, license/provenance, contributor contracts and historical verification records.
- Core remains pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`.

## Local verification

Windows x64; Node 24.14.0, pnpm 11.7.0 through Corepack. Existing pinned core build reused; no engine changes.

- `corepack pnpm install --frozen-lockfile`: passed, lockfile unchanged.
- `corepack pnpm --filter @blinkdisk/desktop build`: passed, including renderer TypeScript checking. `node scripts/copy-frontend.mjs` and `corepack pnpm --filter @blinkdisk/electron compile:prod`: passed.
- `node scripts/smoke-history-ui.mjs`: passed with lazy-loaded history translations and a fresh start on backup history. Both toolbar/menu labels and navigation, existing filter/swap/browse/return, failure/cancel/retry, light/dark and 200% checks pass. Evidence: `%LOCALAPPDATA%\Temp\opencode\diskpond-history-ui-914a3A`.
- `node scripts/capture-readme.mjs`: passed against the built app and real engine. Two sources, two document versions and three total snapshots captured; fresh-history comparison labels verified before visiting Activity. Screenshots reviewed in `docs/images/`.
- `corepack pnpm lint:ci`: passed.
- `corepack pnpm unused`: passed after declaring the screenshot runner's Windows `subst` binary as an OS-tool exception.
- `corepack pnpm --filter @blinkdisk/desktop --filter @blinkdisk/electron --filter "./libs/*" --if-present -r types`: passed.
- `scripts/release-assets.ps1 -ValidateOnly`: accepts `v0.1.0` and `v0.1.0-alpha.3`, rejects an invalid channel. Reviewed stable/latest and prerelease publication flags.
- All 91 local documentation/image links in the changed guides resolve; `git diff --check` passes. GitHub's rendered README includes all three screenshots and no development-project wording. The repository About description, release homepage and backup-related topics are set.
- Upstream application/core comparison against their recorded baselines: both `main` branches remain identical, with no new upstream commits to integrate. The owned core checkout matches the application gitlink.

The package-level frontend wrapper initially failed because the shell lacks a plain `pnpm` shim. Its two steps were run directly through Corepack/Node as recorded above. CI installs the normal pnpm executable.

## Publication

Committed the translation fix as `6be94a3` and release preparation as `4d48be4ba24c7c602a97c66f9d5f9a294020e776`, retaining the existing update commit `8a85153`. Pushed `main` and annotated tag `v0.1.0` atomically to `hoxsec/DiskPond`.

[Release CI 41692668735](https://github.com/hoxsec/DiskPond/actions/runs/41692668735) passed: frozen install, lint, desktop/library/Electron types, all 60 unit-test files, pinned-core/NSIS build, installed startup and bundled-engine backup/restore hashes, asset assembly and publication. The duplicate main-branch check `41692668331` was canceled in favor of the same compact check within the release workflow.

**[v0.1.0](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0) is published**, at `2026-11-03T18:25:53Z`, with 11 assets. GitHub's `/releases/latest` API confirms tag `v0.1.0`, `draft: false` and `prerelease: false`.

Downloaded all assets with `gh release download v0.1.0 --repo hoxsec/DiskPond` into `%LOCALAPPDATA%\Temp\opencode\diskpond-v0.1.0-downloads-35cf165e`. All **10 SHA-256 entries** in `SHA256SUMS.txt` match, including the installer, blockmap, update metadata, both source archives and license/build records. The downloaded `latest.yml` contains version `0.1.0` and its SHA-512 matches the downloaded installer.

The release tag remains on `4d48be4`; the follow-up documentation commit records verified publication only.

GitHub reports 21 open shared-lockfile dependency alerts. A scoped review found the critical Better Auth dependency and high-severity `deepmerge-ts` outside the desktop/Electron dependency trees; affected Seroval serialization code is absent from the production renderer source maps. The two i18next backend alerts require URL templates/input absent from the fixed local path and English allowlist. Alerts remain open for dependency maintenance; this is not a full dependency security audit.

The installer remains unsigned. Extended provider/platform and upgrade matrices, encrypted setup export/import, complete durable attempt history and full uninstall cleanup remain deferred; this release does not certify them.
