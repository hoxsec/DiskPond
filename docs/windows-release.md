# Windows releases

**[Download DiskPond for Windows](https://github.com/hoxsec/DiskPond/releases/latest/download/DiskPond-Windows.exe)** · [Release notes and checksums](https://github.com/hoxsec/DiskPond/releases/latest)

**v0.1.4** targets **Windows 10/11 x64**, adding in-app updates with idle-only installation, release notes, cancellation, size/speed, reminders and local update history. The installer is unsigned. [Release verification](verification/windows-v0.1.4.md) records publication status and checks; broader OS/provider certification remains deferred.

## Install and make a backup

1. Download the installer and `SHA256SUMS.txt` from [DiskPond releases](https://github.com/hoxsec/DiskPond/releases/latest). Compare `Get-FileHash .\DiskPond-Windows.exe -Algorithm SHA256` with its entry.
2. Run the installer. This release is unsigned: Windows can show an unknown-publisher/reputation prompt. Confirm the download's origin before proceeding.
3. Open DiskPond and choose **Create a new vault** for a new destination. Choose **Connect an existing vault** for existing backup storage; creation is not a recovery action.
4. Keep the vault encryption password somewhere recoverable. Add a file/folder source, run a backup and check its terminal result. A connected vault alone does not mean a backup succeeded.
5. Restore a sample backup to a new folder and inspect the recovered files before relying on the setup. Keep backup storage separate from the source when possible.

Scheduled backups need the desktop process running. Closing the window can leave DiskPond in the tray; **Quit** stops it. Disconnected storage needs reconnection before backup/recovery can proceed.

## Recover files

Connect the existing vault using the same destination/provider details and repository password. Open the source's backup history, choose the desired snapshot, browse/select files and restore to a new empty destination. Check the final result and recovered contents. Partial, failed and canceled outcomes are not successful recovery. Preserve the original repository when investigating errors.

## Updates

DiskPond checks GitHub releases at startup and hourly. Choose **Download update** in the banner or Settings, then **Restart and install** once native backups/restores are idle. Downloads show size/speed and can be canceled. **What's new**, a 24-hour **Remind me later** action and local update history are available in the app. **Settings → Check for updates** also works when automatic checks are disabled.

Stable installations check stable releases; prerelease installations also consider prereleases. Downloads and restarts remain user-triggered. See [update behavior and verification](verification/in-app-updates.md). **v0.1.2 and earlier need one manual installer update** to receive this updater: finish active operations, quit DiskPond and run the new installer.

## Build this release

```powershell
git clone --branch v0.1.4 --recurse-submodules https://github.com/hoxsec/DiskPond.git
cd DiskPond
pnpm install --frozen-lockfile
$env:GITHUB_REF_TYPE = 'tag'
$env:GITHUB_REF_NAME = 'v0.1.4'
pnpm build:windows
```

Use the toolchain in [DEVELOPMENT.md](../DEVELOPMENT.md). GitHub's automatic source archives omit submodules; the separate core source asset includes the pinned core and its notices. Source ZIPs are a source record; the existing build wrappers require the Git checkout above.

## Publish a version

Release publication requires owner authorization. Bump `apps/electron/package.json`, add `docs/releases/vVERSION.md` release notes, commit and push the reviewed batch, then push a new annotated version tag. Supported tags are `vMAJOR.MINOR.PATCH` or `vMAJOR.MINOR.PATCH-alpha.N`, `-beta.N`, `-rc.N`. The tag supplies the packaged application version. Never move a published tag. Remove an unpublished failed draft before rerunning the same unchanged tag; code fixes require a new version.

`.github/workflows/release.yml` calls the compact Windows check used for pull requests and main: lint, types, existing unit tests, pinned-core/NSIS build, installed upgrade and updater handoff/relaunch, plus bundled-engine recovery hashes. Only passing checks hand assets to the publishing job. It creates a draft, uploads all assets, then publishes it. Stable versions become GitHub's **Latest** release; prerelease tags do not. No signing secrets are required for the unsigned release path.

Assets include `DiskPond-Windows.exe`, its blockmap, `latest.yml` update metadata, SHA-256 checksums, matching application/core source ZIPs, licenses, provenance and build instructions. Download and verify the published assets before closing the release record.

## Verification scope

The **Desktop extended certification (manual)** Actions workflow retains the earlier provider, discovery, security, full-volume and recovery suites. Run focused suites when changing related behavior; broad certification is deferred under the release-first roadmap.

Recovery evidence is retained in [verification records](verification/). Complete upgrade matrices and provider/platform certification remain deferred. Setup export/import is planned. Uninstall currently may leave app-created startup/URI entries; do not delete backup storage when removing the application.
