# DiskPond — Roadmap

Updated: 2026-11-03. **Goal: get a usable Windows release into the owner's hands now.**

The owner confirms the current workflow works. Existing [Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41645023929) is the baseline; keep working features and fix concrete problems.

## Now — Windows release CI/CD

- [x] Add a version-tag release workflow that builds the pinned core and Windows installer.
- [x] Verify the compact release check in GitHub: [release run 41654918106](https://github.com/hoxsec/DiskPond/actions/runs/41654918106) passed lint/types, unit tests and installed + bundled-engine backup/restore smoke. Extended suites are manual.
- [x] Publish installer, updater metadata, checksums and matching source/license information to [GitHub Release v0.1.0-alpha.1](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.1); downloaded asset checksums verified.
- [x] Cut the first Windows prerelease, **v0.1.0-alpha.1**, unsigned, with owner authorization. [Release/install/recovery instructions](docs/windows-release.md) are available.
- [x] Publish the owner-authorized UI/navigation follow-up, [**v0.1.0-alpha.2**](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.2), from `f872617`. [Release CI 41668791860](https://github.com/hoxsec/DiskPond/actions/runs/41668791860) and all downloaded checksums passed; [evidence](docs/verification/windows-alpha-2.md).

**Done when:** a version tag produces a downloadable installer that the owner can install and use. Broad provider/platform certification does not block this release.

Delivery complete; owner installation and actual-use feedback are next. This does not claim owner acceptance testing has occurred.

## Next — Improve through actual use

The owner authorized committing/pushing the completed comparison and Activity-only calendar batch and publishing **v0.1.0-alpha.3**. [Release status](docs/verification/windows-alpha-3.md) supersedes earlier uncommitted/authorization-pending notes below.

- [x] Apply the owner's latest DP06 correction: calendar only in Home-level Activity; remove the per-vault calendar and compact vault Activity link.

Fix reported backup, scheduling, retention, restore and usability issues. Add encrypted setup export/import and improve updates/diagnostics when needed; these do not block the first release.

- [x] Apply the owner's graphite/blue, clean technical identity with square UI corners; retain the DiskPond artwork and Settings-only Light / Dark / System selector (D10, DP04, F23). [Implementation and focused verification](docs/verification/graphite-blue-identity.md). The owner approved the visual changes and authorized a local commit on 2026-11-03.
- [x] Add **Back to backup history** from snapshot browsing, **Back to vault** from history with the profile filter preserved, and **Back to all profiles** to clear device/user filters in the same vault (F15, F16, F20, DP04). [Focused navigation evidence](docs/verification/profile-history-navigation.md).
- [x] Record the owner's next-feature choices and implementation plan (D14): [snapshot comparison and backup activity calendar](docs/plans/snapshot-comparison-and-activity.md).
- [x] Implement snapshot comparison with added/changed/deleted paths and before/after sizes and modification times (DP05). Bounded/cancelable reads, explicit unknown/partial coverage and paged keyboard-scrollable results; [focused verification](docs/verification/snapshot-comparison-and-activity.md) passes.
- [x] Implement the retained-history activity calendar in a separate Activity tab and in each vault, with concise status labels (DP06). Owner feedback moved it off Home and removed explanatory calendar/comparison prose. Latest known issues are labeled and counted separately; [focused verification](docs/verification/snapshot-comparison-and-activity.md) passes.
- [ ] Owner preview and actual-use feedback on comparison and both calendar placements.

The redesign commit `7a8a6fa` and navigation/planning commit `f872617` are pushed to `main` and included in **v0.1.0-alpha.2**, published with owner authorization. [Release verification](docs/verification/windows-alpha-2.md) passed. The owner subsequently authorized implementing both features in a new session. Their local implementation and focused verification are complete; this batch is not committed or published. Another release requires owner authorization.

## Later — Optional expansion

Live-provider/USB/NAS certification, second-device matrices, macOS/Linux, exhaustive parity, performance and accessibility audits. Keep existing features available; describe unverified cases as deferred, not certified.

Complete historical failure/cancellation accounting needs a separately approved durable attempt-history contract; the delivered calendar intentionally reports available retained history and latest issue evidence.

## Working rule

Small batches, focused local checks, one final GitHub run per release-ready batch. Reuse passing evidence; rerun only for relevant changes or failures. No tests for documentation-only edits. Never label a failed backup or restore as successful.

The old milestones are preserved in [ROADMAP-HISTORY.md](ROADMAP-HISTORY.md); previous task/evidence history is in [TODO-HISTORY.md](TODO-HISTORY.md) and `docs/verification/`. [PLAN.md](PLAN.md) retains the technical contracts and feature inventory.
