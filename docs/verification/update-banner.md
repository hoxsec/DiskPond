# GitHub release update banner — F25

Date: 2026-11-03. Implemented and locally verified in `8a85153`; shipped in the verified [v0.1.0 release](windows-v0.1.0.md).

Version follow-up: the Electron package's local version initially advanced to `0.1.0-alpha.3`, then to `0.1.0` for the first stable release. Settings and updater comparisons both use Electron's `app.getVersion()`. Tagged installers retain the existing tag-derived version override; untagged installer smoke reads the package version. Bump the package version when advancing the local release baseline.

## Behavior

- Packaged apps check at startup and hourly. Electron reads the most recent 100 published GitHub releases, excludes drafts, orders valid versions using SemVer and reads the highest eligible release's direct `latest.yml` asset. Prerelease/dev builds include prereleases; stable installations use stable releases. YAML version must match the release tag. Equal/older versions never trigger the banner. Releases must retain their generated updater metadata.
- A newer release appears in the sidebar with its version and **View GitHub releases**. The action opens `https://github.com/hoxsec/DiskPond/releases` through a sender-validated, no-argument native IPC method.
- Settings → About includes **Check for updates**. Its built-in spinner and disabled state last for the request. Results show up-to-date, available version with **View GitHub releases**, or a retryable error. Manual checks work in development and with automatic checks disabled. Concurrent requests share one check. Native requests have a 15-second deadline and bounded response sizes (1 MB release list, 64 KB YAML).
- Downloads, quit-to-install, automatic installation on quit and the inherited modal are removed from the flow. Backup operations continue normally.
- Settings → **Automatically check for updates** defaults on and persists a validated boolean. Disabling skips subsequent checks; enabling checks immediately. An already-running check may finish.
- Offline failures are logged locally and retried at the next interval. Browser-opening errors remain in the banner with a retryable action. Development builds make no automatic update requests.

## Passing checks

Environment: Windows, Node 24.14.0, pnpm 11.7.0 through Corepack (the plain `pnpm` shim is unavailable in this shell).

- `corepack pnpm --filter @blinkdisk/electron exec vitest run src/updater.test.ts src/renderer-store.test.ts`: 12 tests passed. YAML retrieval/version matching, numerical prerelease ordering, equal/older versions, stable filtering, concurrent checks, HTTP failure/retry, startup/hourly checks, disabled automatic checks and preference validation.
- Electron suite also passed: 22 files / 268 tests (the initial package-script invocation ran the full suite).
- `corepack pnpm --filter @blinkdisk/desktop --filter @blinkdisk/electron --filter "./libs/*" --if-present -r types`: passed; desktop/Electron rechecked after the final hook rename.
- `node scripts/smoke-update-banner.mjs`: passed using the actual banner, Settings check component, listener and state store in isolated Electron with fixture IPC. Hidden/current state, version display, Return-key activation, browser failure/retry, clearing the banner, manual-check spinner/disabled state, up-to-date, failure/retry and available-result actions verified.
- Live direct download of `v0.1.0-alpha.3/latest.yml` returned HTTP 200 with matching version `0.1.0-alpha.3`.
- `corepack pnpm lint:ci`: passed.
- `corepack pnpm unused`: passed after removing the progress component whose only consumer was the retired update dialog.

The UI fixture mocks discovery/browser launch and does not exercise a published-version transition. Installed-artifact discovery against a subsequent release and visual theme/zoom review remain follow-up. Publication is tracked in the [v0.1.0 release record](windows-v0.1.0.md). The existing electron-updater dependency remains only for electron-builder's release metadata generation; runtime discovery uses bounded fetch, YAML parsing and SemVer comparison.
