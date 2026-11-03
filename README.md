# DiskPond

An account-free desktop backup application being developed from [BlinkDisk](https://github.com/blinkdisk/blinkdisk), using the [DiskPond Kopia-derived engine fork](https://github.com/hoxsec/diskpond-core).

DiskPond's target is encrypted, versioned backups to storage you provide: local/external drives, NAS, S3-compatible storage, B2, Google Cloud Storage, Azure, SFTP, WebDAV and Rclone. Windows comes first; macOS and Linux remain required targets.

## Development status

**Windows release first.** The current application passes [Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41645023929), including recovery, packaging and installed smoke. Hosted login, managed cloud storage, billing, configuration sync and telemetry paths are removed.

The latest unsigned Windows prerelease, [**v0.1.0-alpha.2**](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.2), is available with the graphite/blue square-corner design and return navigation through snapshot browsing, backup history and profiles. [Release CI](https://github.com/hoxsec/DiskPond/actions/runs/41668791860) passed packaging and installed backup/restore checks; downloaded checksums match. See [Windows release, installation and recovery instructions](docs/windows-release.md). Snapshot comparison and Activity/per-vault retained-history calendars are implemented and locally verified in an uncommitted, unreleased batch; [evidence and limitations](docs/verification/snapshot-comparison-and-activity.md). Owner preview is next. Encrypted setup export/import, durable attempt history and broader provider/platform certification remain deferred.

See [ROADMAP.md](ROADMAP.md) for Now / Next / Later and [PLAN.md](PLAN.md) for the requirement inventory.

## Build and run

Use the `main` checkout, Node **24.15.0**, pnpm **11.7.0**, and Go **1.25.5**:

```powershell
git submodule update --init --checkout apps/core
pnpm install --frozen-lockfile
pnpm dev:desktop
```

Choose **Open DiskPond** on first launch. Existing local workspaces reopen directly. Desktop development starts the renderer and Electron; the bundled engine starts when storage is probed or a vault connects.

Full commands, prerequisites and isolated smoke checks: [DEVELOPMENT.md](DEVELOPMENT.md).

## Project documents

- [Windows baseline evidence](docs/verification/m1-windows-baseline.md)
- [Service dependency and endpoint inventory](docs/verification/m1-dependencies.md)
- [Platform compatibility findings](docs/verification/m1-platforms.md)
- [Design conventions](STYLE.md) and [contributor instructions](AGENTS.md)
- [Upstream pins, attribution and modification record](UPSTREAM.md)

## Remaining upstream names

The desktop product, artwork, application identifiers and Windows artifacts use **DiskPond**. Remaining `BlinkDisk` names in licenses/About preserve attribution; legacy repository, password and policy identifiers preserve compatibility. Internal `@blinkdisk/*` workspace packages and the external `@blinkdisk/signaldb-electron` dependency retain their existing names.

`apps/api`, `apps/cloud`, `apps/web`, `apps/marketing` and `libs/emails` contain inherited hosted-service sources, excluded from the desktop runtime and build. Their branding, service addresses, commercial copy and legal pages describe upstream BlinkDisk, not DiskPond offerings. DiskPond's project home is [hoxsec/DiskPond](https://github.com/hoxsec/DiskPond); it provides no hosted account, billing or managed-storage service.

## License and credits

DiskPond preserves BlinkDisk's **AGPL-3.0** application license: [LICENSE](LICENSE). The pinned engine preserves its separate **Apache-2.0** license: [apps/core/LICENSE](apps/core/LICENSE). Thank you to the BlinkDisk and Kopia contributors. Third-party dependencies and assets retain their own licenses.
