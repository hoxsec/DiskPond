# Windows v0.1.0-alpha.2

Date: 2026-11-03. Status: **published; release CI and downloaded asset verification passed**.

## Release batch

The owner requested committing and pushing all current work to `main`, followed by a new release. This continues the existing unsigned Windows x64 alpha channel as **v0.1.0-alpha.2**.

- Graphite/blue, square-corner identity, approved in the local preview (D10, DP04, F23); identity commit `7a8a6fa`.
- **Back to backup history**, **Back to vault** and **Back to all profiles**, preserving profile context and providing accessible keyboard return paths (F15, F16, F20, DP04).
- Snapshot comparison and Home/per-vault activity calendar plans (D14, DP05/DP06); these remain future features.
- Engine pin: `0f31eefe409cb4f0571baf65abd7d063784598cd` from `hoxsec/diskpond-core`.

## Verification

Passing local evidence is reused from the [identity review](graphite-blue-identity.md) and [navigation review](profile-history-navigation.md): frontend TypeScript/build, lint, focused helper tests and isolated keyboard/theme/zoom interaction checks. No backup engine, security, repository format, dependency or packaging code is changed by this batch.

The tagged **Windows release** workflow passed the compact release check: lint/types, unit tests, pinned-core Windows installer build, installed startup and bundled-engine backup/restore hash smoke, then source/license/checksum assembly and publication. This is the authoritative final GitHub run for the release-ready batch.

- [x] Commit and push the full reviewed batch to `main`: `f87261709b96ad15c56e0ef649b90771fa4f88fb`, following identity commit `7a8a6fa`.
- [x] Publish annotated tag `v0.1.0-alpha.2` at that application revision.
- [x] Passing tag-triggered release checks and publication.
- [x] Download release assets and verify all SHA-256 entries and installer/update version metadata.

[Release run 41668791860](https://github.com/hoxsec/DiskPond/actions/runs/41668791860) passed both the Windows check and publishing jobs. The duplicate branch-push run `41668756253` was canceled to avoid repeating the same compact Windows checks. Full provider/platform/parity certification remains deferred under D13.

## Published assets

[v0.1.0-alpha.2](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.2) was published at `2026-11-03T16:01:27Z`, non-draft and marked prerelease. The annotated tag resolves to application `f87261709b96ad15c56e0ef649b90771fa4f88fb`; the core pin is listed above. Release-page notes describe the visual/navigation changes and planned features.

All **11 assets** were downloaded with `gh release download v0.1.0-alpha.2 --repo hoxsec/DiskPond`; all **10 entries** in `SHA256SUMS.txt` match recomputed SHA-256 values. The updater metadata declares `0.1.0-alpha.2`, and its SHA-512 matches the downloaded installer. `Get-AuthenticodeSignature` reports `NotSigned`, consistent with the unsigned release channel. Source metadata records the exact application/core revisions; the application archive has 1097 entries and the core archive 1289, both including LICENSE.

Installer SHA-256:

```text
19c59e3fb98d5f919fe14996cf46dadf74ffebc74fe5f088c730857b60550772
```

Local download verification script, JSON results and assets are retained in `%LOCALAPPDATA%\Temp\opencode\diskpond-alpha-2-release`. This publication record is a documentation-only follow-up on `main`; release binaries/source archives remain tied to the immutable tag. Owner installation and actual-use feedback are next.
