# Windows v0.1.0-alpha.3

Date: 2026-11-03. Owner explicitly authorized committing and pushing the current batch to `main` and making a new release.

## Release scope

- DP05: same-source snapshot comparison, added/changed/deleted/unknown paths, before/after sizes and modification times, bounded and cancelable reads.
- DP06: retained backup calendar only in the Home-level **Activity** tab, with vault filtering and day drill-down. No calendar on Home content or vault pages; no Activity link in vault navigation.
- DP04: concise calendar/comparison labels with explanatory prose removed.
- Preserve profile/history return navigation, account-free behavior and the core pin `0f31eefe409cb4f0571baf65abd7d063784598cd`.

## Verification and publication

Focused implementation, native recovery and UI evidence: [snapshot comparison and activity](snapshot-comparison-and-activity.md). Latest presentation checks passed desktop types, lint and the actual-component Electron UI smoke, including keyboard navigation and 200% zoom.

Published [v0.1.0-alpha.3](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.3) from application `660fff0adfd27a7cfe443c27fab68f2d81964afd`. [Release CI 41687237347](https://github.com/hoxsec/DiskPond/actions/runs/41687237347) passed lint, types, unit tests, Windows packaging, installed startup/bundled-engine backup and restore hash smoke, asset assembly and publication.

Downloaded every release asset using `gh release download v0.1.0-alpha.3 --repo hoxsec/DiskPond` into `%LOCALAPPDATA%\Temp\opencode\diskpond-alpha-3-downloads`. All **10** SHA-256 entries match `SHA256SUMS.txt`, including installer, blockmap, updater metadata, both source archives, notices and build instructions.

The release remains unsigned and a prerelease; owner installation/actual-use feedback, durable attempt history and broad provider/platform certification remain deferred. No application or core changes were made after the release tag; the follow-up commit records publication evidence only.
