# DiskPond — Next work

**v0.1.3 is authorized for release**, adding in-app updates and six updater refinements. [Release CI, installed-updater checks and publication](docs/verification/windows-v0.1.3.md) are pending. v0.1.2 remains GitHub Latest until publication. Live RustFS/SFTP validation remains pending.

1. Collect installation and actual-use feedback; fix concrete issues in small batches.
   - In-app updates and all six selected refinements (F25) are implemented locally: idle-only install, release notes, cancellation, size/speed, reminders and history. Verify a real installed Windows upgrade before releasing this batch; see [evidence](docs/verification/in-app-updates.md).
2. Follow the [roadmap](ROADMAP.md) for setup export/import, diagnostics and deferred platform/provider work. Durable failure/cancellation history still needs a separate persistence decision.

Use focused checks for changed behavior and one final release CI run. [Installation and recovery](docs/windows-release.md).
