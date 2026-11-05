param(
    [switch]$ValidateOnly,
    [string]$OutputDirectory = 'release-assets'
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$tag = $env:GITHUB_REF_NAME
# Restrict prereleases to alpha/beta/rc numeric channels; reject ambiguous versions.
if ($env:GITHUB_REF_TYPE -ne 'tag' -or $tag -cnotmatch '^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(alpha|beta|rc)\.(0|[1-9][0-9]*))?$') {
    throw 'Expected vMAJOR.MINOR.PATCH[-alpha.N|-beta.N|-rc.N]'
}
if ($ValidateOnly) { return }
$version = $tag.Substring(1)
$app = git rev-parse HEAD
$core = git rev-parse HEAD:apps/core
if ((git -C apps/core rev-parse HEAD) -ne $core) { throw 'Core gitlink mismatch' }
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory $output | Out-Null
$dist = 'apps/electron/dist'
$metadata = Get-Content "$dist/latest.yml" -Raw
if ($metadata -notmatch "(?m)^version: $([regex]::Escape($version))\r?$") { throw 'Updater version differs from tag' }
$installer = Join-Path $dist 'DiskPond-Windows.exe'
$sha512 = [Convert]::ToBase64String([System.Security.Cryptography.SHA512]::HashData([System.IO.File]::ReadAllBytes($installer)))
if ($metadata -notmatch "(?m)^sha512: $([regex]::Escape($sha512))\r?$") { throw 'Updater hash differs from installer' }
foreach ($file in @('DiskPond-Windows.exe', 'DiskPond-Windows.exe.blockmap', 'latest.yml')) {
    Copy-Item (Join-Path $dist $file) $output
}
git archive --format=zip --output="$output/DiskPond-$tag-source.zip" HEAD
git -C apps/core archive --format=zip --output="$output/DiskPond-$tag-core-source.zip" $core
Copy-Item LICENSE, UPSTREAM.txt, DEVELOPMENT.txt $output
Copy-Item apps/core/LICENSE "$output/core-LICENSE.txt"
$notesPath = Join-Path 'docs/releases' "$tag.txt"
$summary = if (Test-Path $notesPath) { Get-Content $notesPath -Raw } else { 'Encrypted desktop backups to storage you control. See the installation guide for features and supported platforms.' }
@"
# DiskPond $tag — Windows x64

$summary

## Verification and source

Unsigned Windows build. Compare SHA256SUMS.txt with the downloaded assets.

Install DiskPond-Windows.exe. See https://github.com/hoxsec/DiskPond/blob/$tag/docs/windows-release.txt for installation, backup and recovery instructions and current limitations.

Application source: $app
Core source: $core (hoxsec/diskpond-core)

The two source ZIPs contain the exact tracked application and core source. Extract the application ZIP, then the core ZIP into apps/core. Licenses, notices, pinned dependency manifests and build instructions are included. For the Git-based build wrappers, clone tag $tag recursively as described in DEVELOPMENT.txt instead; GitHub's automatic source archives alone omit the core submodule.

Checks: lint, desktop types, existing unit tests, Windows packaging, installed desktop-only package contents, upgrade, in-app updater handoff/relaunch and bundled-engine recovery hashes. Prior recovery evidence is retained in docs/verification. Updates download inside DiskPond and offer explicit restart/install when native work is idle. Versions through v0.1.2 need one manual installer update to receive this updater.

DiskPond derives from BlinkDisk (AGPL-3.0); the Kopia-derived core retains Apache-2.0. See LICENSE, core-LICENSE.txt and UPSTREAM.txt.
"@ | Set-Content "$output/RELEASE-NOTES.txt" -Encoding utf8
Get-ChildItem $output -File | Sort-Object Name | ForEach-Object {
    "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())  $($_.Name)"
} | Set-Content "$output/SHA256SUMS.txt" -Encoding utf8
