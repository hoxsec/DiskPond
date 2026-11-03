# Windows release CI/CD — local verification

Date: 2026-11-03. Scope: D13, F26/Q07 distribution slice; F25 metadata only, not automatic-update certification.

Application: working changes on `b58b03ba61ed45efd99937c122195b0646ff54b6`. Core unchanged at `0f31eefe409cb4f0571baf65abd7d063784598cd`. Windows 11 x64 (10.0.26200), Node 24.14.0, pnpm 11.7.0, Go 1.25.5; CI retains Node 24.15.0. The local pre-existing toolchain was added to the process PATH after the initial invocation could not find pnpm/Go.

## Implemented

- Shared compact PR/main/tag Windows check: lint, types, existing unit tests, core/installer build, installed smoke with bundled-engine recovery.
- Earlier extended workflow preserved as manual `desktop-extended.yml`.
- Validated version tags, unsigned artifacts, source ZIPs for the exact application/core revisions, notices/build instructions and SHA-256 manifest.
- Build job has read-only repository permissions; separate publishing job receives only the successful run's assets, creates a draft, uploads them and publishes. Prerelease tags set GitHub prerelease status. Existing releases are not overwritten.
- Owner selected `v0.1.0-alpha.1`, unsigned, authorized the source merge/cleanup and then requested one release. The tag and prerelease are now published.

## Results

| Check | Result |
| --- | --- |
| `pnpm lint:ci` | Passed, 709 files. |
| `pnpm types:desktop` | Passed. |
| `pnpm test:desktop` | Passed: 630 tests across 56 files. |
| `pnpm build:windows` with `GITHUB_REF_TYPE=tag`, `GITHUB_REF_NAME=v0.1.0-alpha.1` | Passed. Built pinned core and unsigned NSIS installer; `latest.yml` contains version `0.1.0-alpha.1`. |
| `pnpm smoke:windows` with the same tag environment | Passed: installed version, onboarding, IPC, nonmutating discovery, packaged licenses/updater identity, bundled-engine snapshot/restore, normal quit and uninstall. |
| `scripts/release-assets.ps1 -OutputDirectory <isolated temporary directory>` | Passed. Assembled installer, blockmap, metadata, both source ZIPs, licenses/provenance/build instructions/notes and checksums; metadata version and SHA-512 matched the installer. |
| Release asset inspection | All SHA-256 entries recomputed successfully; application ZIP had 1088 entries, core ZIP 1289, both with LICENSE. `Get-AuthenticodeSignature` reported `NotSigned`. |
| Tag validation | Accepted alpha/stable/rc examples; rejected leading-zero version/prerelease numbers, shell punctuation and branch names. |
| `go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7 .github/workflows/desktop.yml .github/workflows/desktop-extended.yml .github/workflows/release.yml` | Passed. |

The installed recovery fixture creates a local encrypted repository using the **installed** core executable. It snapshots a Unicode-named file and an empty file, removes only its disposable source, restores into a new directory and verifies exact entries, SHA-256 and empty content. It checks the process exit result and cleans its fixtures. The existing installed test still records/cleans inherited startup/URI uninstall leftovers. This compact CLI recovery supplements existing renderer recovery evidence rather than recertifying that journey.

Local asset assembly archives committed HEAD, so its test ZIPs intentionally exclude this uncommitted implementation. On a tagged checkout the archives include the tagged release implementation. They are not published release candidates.

## Publication

Application `dd6e3c2e68e7d7aacbf4b82887bd033337c2834a` was fast-forward merged to `main`; [main CI 41653650520](https://github.com/hoxsec/DiskPond/actions/runs/41653650520) passed. Other DiskPond branches were deleted and the unmerged Dependabot PR was closed at the owner's request.

Annotated tag `v0.1.0-alpha.1` points to that application commit. [Release run 41654918106](https://github.com/hoxsec/DiskPond/actions/runs/41654918106) passed the compact check, tagged installed smoke, asset assembly/upload and publication. [The release](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.1) is public, non-draft and marked prerelease. All 11 assets were downloaded; all 10 entries in SHA256SUMS.txt matched. Installer SHA-256: `1c367429197eedd4e16eec38e3facfae12c22891fbd42eb6a82919ddcd761aa6`.

## Remaining

Release delivery is complete. Owner installation and actual-use feedback remain pending. Broad provider/platform certification, upgrades, automatic-update installation, signing and exhaustive parity are deferred. Prior Windows recovery evidence: [run 41645023929](https://github.com/hoxsec/DiskPond/actions/runs/41645023929).
