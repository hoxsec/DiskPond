# DiskPond — Next work

**v0.1.4 is published and verified**, adding in-app updates and six updater refinements. It is GitHub Latest; release CI, installed upgrade/updater/recovery and all 10 downloaded checksums passed. [Release record](docs/verification/windows-v0.1.4.md). Live RustFS/SFTP validation remains pending.

1. Collect installation and actual-use feedback; fix concrete issues in small batches.
   - In-app updates and all six selected refinements (F25) are released: idle-only install, release notes, cancellation, size/speed, reminders and history. Installed Windows checks passed; collect feedback from real upgrades. See [evidence](docs/verification/in-app-updates.md).
2. Follow the [roadmap](ROADMAP.md) for setup export/import, diagnostics and deferred platform/provider work. Durable failure/cancellation history still needs a separate persistence decision.

Use focused checks for changed behavior and one final release CI run. [Installation and recovery](docs/windows-release.md).
