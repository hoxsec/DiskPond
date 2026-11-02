# DiskPond

An account-free desktop backup application being developed from [BlinkDisk](https://github.com/blinkdisk/blinkdisk), using its [Kopia-derived engine](https://github.com/blinkdisk/core).

DiskPond's target is encrypted, versioned backups to storage you provide: local/external drives, NAS, S3-compatible storage, B2, Google Cloud Storage, Azure, SFTP, WebDAV and Rclone. Windows comes first; macOS and Linux remain required targets.

## Development status

**M1 complete — verified Windows development baseline.** The pinned engine, desktop and installer pass local checks and [clean Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41521154820). Built, development and installed smoke checks reach the inherited local workspace and probe the real engine. Backup/restore certification is still ahead.

The imported interface still contains BlinkDisk branding and account/cloud features. M2 will replace those with DiskPond's local workspace and original design, remove service/analytics code, and verify the first complete backup/restore journey. Encrypted setup export/import follows in M5. There is no DiskPond stable installer release yet.

See [ROADMAP.md](ROADMAP.md) for milestone gates and [PLAN.md](PLAN.md) for the full requirement inventory.

## Build and run

Use the `integrate/blinkdisk-baseline` checkout, Node **24.15.0**, pnpm **11.7.0**, and Go **1.25.5**:

```powershell
git submodule update --init --checkout apps/core
pnpm install --frozen-lockfile
pnpm dev:desktop
```

On the inherited welcome screen, choose **Continue without account**, then **Continue anyway** to reach the local workspace. Desktop development starts the renderer and Electron; the bundled engine starts when storage is probed or a vault connects.

Full commands, prerequisites and isolated smoke checks: [DEVELOPMENT.md](DEVELOPMENT.md).

## Project documents

- [Windows baseline evidence](docs/verification/m1-windows-baseline.md)
- [Service dependency and endpoint inventory](docs/verification/m1-dependencies.md)
- [Platform compatibility findings](docs/verification/m1-platforms.md)
- [Design conventions](STYLE.md) and [contributor instructions](AGENTS.md)
- [Upstream pins, attribution and modification record](UPSTREAM.md)

## License and credits

DiskPond preserves BlinkDisk's **AGPL-3.0** application license: [LICENSE](LICENSE). The pinned engine preserves its separate **Apache-2.0** license: [apps/core/LICENSE](apps/core/LICENSE). Thank you to the BlinkDisk and Kopia contributors. Third-party dependencies and assets retain their own licenses.
