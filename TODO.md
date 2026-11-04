# DiskPond — Next work

**v0.1.4 is published and verified**, adding in-app updates and six updater refinements. It is GitHub Latest; release CI, installed upgrade/updater/recovery and all 10 downloaded checksums passed. [Release record](docs/verification/windows-v0.1.4.md). Live RustFS/SFTP validation remains pending.

1. Complete owner-authorized **v0.1.5** branch/merge publication and release verification, including desktop-only installer contents. [Release record](docs/verification/windows-v0.1.5.md). Preview the website with `pnpm dev:site` (D16 / WEB01); hosting, checkout and managed-storage readiness remain WEB02 work. [Website source and launch details](apps/marketing/README.md).
2. Collect installation and actual-use feedback; fix concrete issues in small batches.
   - In-app updates and all six selected refinements (F25) are released: idle-only install, release notes, cancellation, size/speed, reminders and history. Installed Windows checks passed; collect feedback from real upgrades. See [evidence](docs/verification/in-app-updates.md).
3. Follow the [roadmap](ROADMAP.md) for setup export/import, diagnostics and deferred platform/provider work. Durable failure/cancellation history still needs a separate persistence decision.

Use focused checks for changed behavior and one final release CI run. [Installation and recovery](docs/windows-release.md).
