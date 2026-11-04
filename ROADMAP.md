# DiskPond — Roadmap

Updated: 2026-11-04. **[v0.1.5](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.5)** is published as GitHub Latest with owner authorization. [Release CI, installed-package/upgrade/updater/recovery checks and downloaded checksums passed](docs/verification/windows-v0.1.5.md).

## Now — Stable Windows releases

- [x] Publish owner-authorized **v0.1.5** with the website/screenshot batch and an installed-package check that excludes website files from the Windows installer. Release CI, installed upgrade/updater/recovery and all 10 downloaded checksums passed. [Release record](docs/verification/windows-v0.1.5.md).

- [x] Publish **v0.1.4** with the owner-authorized in-app updater batch. Compact Windows CI, installed upgrade/updater/recovery and all 10 downloaded checksums passed. [Release record](docs/verification/windows-v0.1.4.md).

- [x] Publish owner-authorized **v0.1.2** with RustFS/SFTP storage reporting. Compact Windows CI, installed recovery and all 10 downloaded checksums passed. [Release record](docs/verification/windows-v0.1.2.md).

- [x] Deliver tag-triggered Windows installer, updater metadata, checksums and matching source/license assets. The three alpha releases have passing publication and installed backup/restore evidence.
- [x] Deliver the graphite/blue identity, history/profile return navigation, snapshot comparison and Home-level Activity tab (DP04–DP06).
- [x] Add the GitHub update banner and Settings **Check for updates** (F25).
- [x] Fix cold-start comparison translations, refresh the README with features/screenshots and remove obsolete root service setup files.
- [x] Publish **v0.1.0** as the first stable release. Compact Windows release CI and all 10 downloaded asset checksums passed. [Release record](docs/verification/windows-v0.1.0.md).
- [x] Publish **v0.1.1** with the available-space, Activity and launcher improvements below. Compact Windows release CI, installed recovery and all 10 downloaded checksums passed. [Release record](docs/verification/windows-v0.1.1.md).

## Next — Improve through actual use

### Website and optional managed storage (D16)

- [x] Implement the DiskPond prelaunch marketing site (WEB01), with real screenshots, Windows downloads, cloud plans, annual pricing, email enquiries and guides. [Verification](docs/verification/website.md).
- [x] Refresh website/README imagery with nine real app views in both themes, visible scheduling/recovery features and all 11 storage connection options (WEB01 / DP04). [Screenshot details](docs/verification/website.md#screenshot-and-connectivity-expansion).
- [ ] Confirm hosting/deployment and connect `diskpond.com`.
- [ ] Deliver live cloud purchases and storage (WEB02): checkout, provisioning/connection design, service readiness and seller/service terms. Owner pricing is €5/month VAT included for 500 GB, €45/year, enterprise by enquiry.

### Desktop feedback

Fix reported backup, scheduling, retention, restore and usability issues. Collect installation and everyday-use feedback on the stable release. Add encrypted setup export/import and improve diagnostics when needed.

- [x] Verify the installed Windows upgrade and updater fixture for v0.1.4 (F25). v0.1.2 replacement/preferences, native download/checksum, NSIS handoff/relaunch, truthful synthetic-version history and post-update recovery hash passed; [verification](docs/verification/in-app-updates.md).
- [x] Implement the owner-selected updater improvements (F25): idle-only installation, release notes, cancellation, download size/speed, 24-hour reminders and bounded local update history. Native tests, keyboard/UI checks and real-engine backup/restore activity plus 32 restored hashes passed locally; [evidence](docs/verification/in-app-updates.md).

- [x] Add **Storage available** to vault overviews for filesystem destinations (F06 / P01–P03), with explicit unavailable/unsupported states. [Verification](docs/verification/vault-storage-space.md); released in v0.1.1.
- [x] Compact Activity's backup and latest-issue details into individually expandable rows (DP06 / DP04), keeping key metadata visible. [Verification](docs/verification/activity-compact-rows.md); released in v0.1.1.
- [x] Fix Windows build/development launchers for standalone `pnpm.exe`, including nested scripts (D13). [Verification](docs/verification/desktop-pnpm-launcher.md); released in v0.1.1.
- [x] Add RustFS bucket-quota remaining capacity to S3 vault overviews (F06 / P05). [Local verification](docs/verification/rustfs-quota.md); released in v0.1.2, live RustFS validation pending.
- [x] Add SFTP destination available space through the OpenSSH statvfs extension (F06 / P09). [Local verification](docs/verification/sftp-storage-space.md); released in v0.1.2, live-provider validation pending.

## Later — Optional expansion

Live-provider/USB/NAS certification, second-device matrices, macOS/Linux, exhaustive parity, performance and accessibility audits. Keep existing features available; describe unverified cases as deferred, not certified.

Complete historical failure/cancellation accounting needs a separately approved durable attempt-history contract; the delivered calendar intentionally reports available retained history and latest issue evidence.

## Working rule

Small batches, focused local checks, one final GitHub run per release-ready batch. Reuse passing evidence; rerun only for relevant changes or failures. No tests for documentation-only edits. Never label a failed backup or restore as successful.

Website builds and previews are separate from desktop release tasks. Publication still requires an owner request.

The old milestones are preserved in [ROADMAP-HISTORY.md](ROADMAP-HISTORY.md); previous task/evidence history is in [TODO-HISTORY.md](TODO-HISTORY.md) and `docs/verification/`. [PLAN.md](PLAN.md) retains the technical contracts and feature inventory.
