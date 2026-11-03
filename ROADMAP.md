# DiskPond — Roadmap

Updated: 2026-11-03. **Goal: get a usable Windows release into the owner's hands now.**

The owner confirms the current workflow works. Existing [Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41645023929) is the baseline; keep working features and fix concrete problems.

## Now — Windows release CI/CD

- [x] Add a version-tag release workflow that builds the pinned core and Windows installer.
- [x] Verify the compact release check in GitHub: [release run 41654918106](https://github.com/hoxsec/DiskPond/actions/runs/41654918106) passed lint/types, unit tests and installed + bundled-engine backup/restore smoke. Extended suites are manual.
- [x] Publish installer, updater metadata, checksums and matching source/license information to [GitHub Release v0.1.0-alpha.1](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.1); downloaded asset checksums verified.
- [x] Cut the first Windows prerelease, **v0.1.0-alpha.1**, unsigned, with owner authorization. [Release/install/recovery instructions](docs/windows-release.md) are available.

**Done when:** a version tag produces a downloadable installer that the owner can install and use. Broad provider/platform certification does not block this release.

Delivery complete; owner installation and actual-use feedback are next. This does not claim owner acceptance testing has occurred.

## Next — Improve through actual use

Fix reported backup, scheduling, retention, restore and usability issues. Add encrypted setup export/import and improve updates/diagnostics when needed; these do not block the first release.

- [x] Apply the owner's graphite/blue, clean technical identity with square UI corners; retain the DiskPond artwork and Settings-only Light / Dark / System selector (D10, DP04, F23). [Implementation and focused verification](docs/verification/graphite-blue-identity.md). The owner approved the visual changes and authorized a local commit on 2026-11-03.

## Later — Optional expansion

Live-provider/USB/NAS certification, second-device matrices, macOS/Linux, exhaustive parity, performance and accessibility audits. Keep existing features available; describe unverified cases as deferred, not certified.

## Working rule

Small batches, focused local checks, one final GitHub run per release-ready batch. Reuse passing evidence; rerun only for relevant changes or failures. No tests for documentation-only edits. Never label a failed backup or restore as successful.

The old milestones are preserved in [ROADMAP-HISTORY.md](ROADMAP-HISTORY.md); previous task/evidence history is in [TODO-HISTORY.md](TODO-HISTORY.md) and `docs/verification/`. [PLAN.md](PLAN.md) retains the technical contracts and feature inventory.
