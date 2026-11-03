# Windows v0.1.0-alpha.3

Date: 2026-11-03. Owner explicitly authorized committing and pushing the current batch to `main` and making a new release.

## Release scope

- DP05: same-source snapshot comparison, added/changed/deleted/unknown paths, before/after sizes and modification times, bounded and cancelable reads.
- DP06: retained backup calendar only in the Home-level **Activity** tab, with vault filtering and day drill-down. No calendar on Home content or vault pages; no Activity link in vault navigation.
- DP04: concise calendar/comparison labels with explanatory prose removed.
- Preserve profile/history return navigation, account-free behavior and the core pin `0f31eefe409cb4f0571baf65abd7d063784598cd`.

## Verification and publication

Focused implementation, native recovery and UI evidence: [snapshot comparison and activity](snapshot-comparison-and-activity.md). Latest presentation checks passed desktop types, lint and the actual-component Electron UI smoke, including keyboard navigation and 200% zoom.

Publication is pending the tag-triggered compact Windows workflow: lint, types, unit tests, packaging, installed recovery smoke and publication. Downloaded asset checksums will be verified after publication. The release remains unsigned and a prerelease; durable attempt history and broad provider/platform certification remain deferred.
