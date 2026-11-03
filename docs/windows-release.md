# Windows releases

The latest release is [**v0.1.0-alpha.2**](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.2), an **unsigned Windows x64 prerelease**, published with owner authorization on 2026-11-03. It includes the graphite/blue square-corner design and return navigation through snapshot browsing, backup history and profiles. [Release CI and downloaded asset verification](verification/windows-alpha-2.md) passed. Windows 10/11 is the initial target; broader OS/provider certification is deferred.

## Publish a version

The owner has authorized **v0.1.0-alpha.3** with snapshot comparison and the Home-level Activity calendar. See [the release record](verification/windows-alpha-3.md) for publication status; the preceding release remains the latest verified download until the new workflow succeeds.

Commit and push the reviewed release batch first. The current release used the following commands; for another release, choose a new version rather than repeating this existing tag:

```powershell
git tag -a v0.1.0-alpha.2 -m "DiskPond Windows alpha 2"
git push origin v0.1.0-alpha.2
```

Pushing the tag authorizes automatic publication. Supported tags are `vMAJOR.MINOR.PATCH` or `vMAJOR.MINOR.PATCH-alpha.N`, `-beta.N`, `-rc.N`. The tag supplies the packaged application version. Never move a published tag. Remove an unpublished failed draft before rerunning the same unchanged tag; code fixes require a new version.

`.github/workflows/release.yml` calls the compact Windows check used for pull requests and main: lint, types, existing unit tests, pinned-core/NSIS build and installed startup + bundled-engine backup/restore hash smoke. Only passing checks hand assets to the publishing job. It creates a draft, uploads all assets, then publishes it. Prerelease tags produce GitHub prereleases. Releases do not automatically become GitHub's latest release. No signing secrets are required for this unsigned release path.

Assets include `DiskPond-Windows.exe`, its blockmap, `latest.yml` updater metadata (the existing GitHub packager's filename, including for prereleases), SHA-256 checksums, matching application/core source ZIPs, licenses, provenance and build instructions. Automatic-update installation and upgrade migrations are not certified by this workflow. Install prereleases manually.

For a source checkout with the exact engine and Git metadata required by the build scripts:

```powershell
git clone --branch v0.1.0-alpha.2 --recurse-submodules https://github.com/hoxsec/DiskPond.git
cd DiskPond
pnpm install --frozen-lockfile
$env:GITHUB_REF_TYPE = 'tag'
$env:GITHUB_REF_NAME = 'v0.1.0-alpha.2'
pnpm build:windows
```

Use the toolchain in [DEVELOPMENT.md](../DEVELOPMENT.md). GitHub's automatic source archives omit submodules; the separate core source asset includes the pinned core and its notices. Source ZIPs are a source record; the existing build wrappers require the Git checkout above.

The **Desktop extended certification (manual)** Actions workflow retains the earlier provider, discovery, security, full-volume and recovery suites. Run focused suites when changing related behavior; broad certification is not a first-release gate.

## Install and make a backup

1. Download the installer and `SHA256SUMS.txt` from [DiskPond releases](https://github.com/hoxsec/DiskPond/releases). Compare `Get-FileHash .\DiskPond-Windows.exe -Algorithm SHA256` with its entry.
2. Run the installer. This release is unsigned: Windows can show an unknown-publisher/reputation prompt. Confirm the download's origin before proceeding.
3. Open DiskPond and choose **Create a new vault** for a new destination. Choose **Connect an existing vault** for existing backup storage; creation is not a recovery action.
4. Keep the vault encryption password somewhere recoverable. Add a file/folder source, run a backup and check its terminal result. A connected vault alone does not mean a backup succeeded.
5. Restore a sample backup to a new folder and inspect the recovered files before relying on the setup. Keep backup storage separate from the source when possible.

Scheduled backups need the desktop process running. Closing the window can leave DiskPond in the tray; **Quit** stops it. Disconnected storage needs reconnection before backup/recovery can proceed.

## Recover files

Connect the existing vault using the same destination/provider details and repository password. Open the source's backup history, choose the desired snapshot, browse/select files and restore to a new empty destination. Check the final result and recovered contents. Partial, failed and canceled outcomes are not successful recovery. Preserve the original repository when investigating errors.

Local recovery evidence exists in [verification records](verification/); this alpha does not claim exhaustive provider, compatibility or platform certification. Setup export/import remains planned. Uninstall currently may leave app-created startup/URI entries; do not delete backup storage when removing the application.
