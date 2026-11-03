# DiskPond — Roadmap

Updated: 2026-11-03. **Goal: get a usable Windows release into the owner's hands now.**

The owner confirms the current workflow works. Existing [Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41645023929) is the baseline; keep working features and fix concrete problems.

## Now — Windows release CI/CD

- [ ] Add a version-tag release workflow that builds the pinned core and Windows installer.
- [ ] Run one release check: lint/types, existing unit tests and a small install + backup/restore smoke check. Keep extended suites manual; add focused checks only for changed backup/security logic.
- [ ] Upload the installer, updater metadata, checksums and matching source/license information to a GitHub Release in `hoxsec/DiskPond`.
- [ ] Document the tag/release command, installation and recovery basics; cut the first Windows prerelease. Signing availability and the first version/tag are settled before publishing.

**Done when:** a version tag produces a downloadable installer that the owner can install and use. Broad provider/platform certification does not block this release.

## Next — Improve through actual use

Fix reported backup, scheduling, retention, restore and usability issues. Add encrypted setup export/import and improve updates/diagnostics when needed; these do not block the first release.

## Later — Optional expansion

Live-provider/USB/NAS certification, second-device matrices, macOS/Linux, exhaustive parity, performance and accessibility audits. Keep existing features available; describe unverified cases as deferred, not certified.

## Working rule

Small batches, focused local checks, one final GitHub run per release-ready batch. Reuse passing evidence; rerun only for relevant changes or failures. No tests for documentation-only edits. Never label a failed backup or restore as successful.

The old milestones are preserved in [ROADMAP-HISTORY.md](ROADMAP-HISTORY.md); previous task/evidence history is in [TODO-HISTORY.md](TODO-HISTORY.md) and `docs/verification/`. [PLAN.md](PLAN.md) retains the technical contracts and feature inventory.
