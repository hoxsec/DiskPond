# DiskPond — Roadmap

Updated: 2026-11-03. **[v0.1.1](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.1)** is published as GitHub Latest with owner authorization. [Release CI and downloaded checksums passed](docs/verification/windows-v0.1.1.md).

## Now — Stable Windows releases

- [x] Deliver tag-triggered Windows installer, updater metadata, checksums and matching source/license assets. The three alpha releases have passing publication and installed backup/restore evidence.
- [x] Deliver the graphite/blue identity, history/profile return navigation, snapshot comparison and Home-level Activity tab (DP04–DP06).
- [x] Add the GitHub update banner and Settings **Check for updates** (F25).
- [x] Fix cold-start comparison translations, refresh the README with features/screenshots and remove obsolete root service setup files.
- [x] Publish **v0.1.0** as the first stable release. Compact Windows release CI and all 10 downloaded asset checksums passed. [Release record](docs/verification/windows-v0.1.0.md).
- [x] Publish **v0.1.1** with the available-space, Activity and launcher improvements below. Compact Windows release CI, installed recovery and all 10 downloaded checksums passed. [Release record](docs/verification/windows-v0.1.1.md).

## Next — Improve through actual use

Fix reported backup, scheduling, retention, restore and usability issues. Collect installation and everyday-use feedback on the stable release. Add encrypted setup export/import and improve diagnostics when needed.

- [x] Add **Storage available** to vault overviews for filesystem destinations (F06 / P01–P03), with explicit unavailable/unsupported states. [Verification](docs/verification/vault-storage-space.md); released in v0.1.1.
- [x] Compact Activity's backup and latest-issue details into individually expandable rows (DP06 / DP04), keeping key metadata visible. [Verification](docs/verification/activity-compact-rows.md); released in v0.1.1.
- [x] Fix Windows build/development launchers for standalone `pnpm.exe`, including nested scripts (D13). [Verification](docs/verification/desktop-pnpm-launcher.md); released in v0.1.1.

## Later — Optional expansion

Live-provider/USB/NAS certification, second-device matrices, macOS/Linux, exhaustive parity, performance and accessibility audits. Keep existing features available; describe unverified cases as deferred, not certified.

Complete historical failure/cancellation accounting needs a separately approved durable attempt-history contract; the delivered calendar intentionally reports available retained history and latest issue evidence.

## Working rule

Small batches, focused local checks, one final GitHub run per release-ready batch. Reuse passing evidence; rerun only for relevant changes or failures. No tests for documentation-only edits. Never label a failed backup or restore as successful.

The old milestones are preserved in [ROADMAP-HISTORY.md](ROADMAP-HISTORY.md); previous task/evidence history is in [TODO-HISTORY.md](TODO-HISTORY.md) and `docs/verification/`. [PLAN.md](PLAN.md) retains the technical contracts and feature inventory.
