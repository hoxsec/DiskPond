# Windows v0.1.0-alpha.2

Date: 2026-11-03. Status: **owner-authorized; publication pending**.

## Release batch

The owner requested committing and pushing all current work to `main`, followed by a new release. This continues the existing unsigned Windows x64 alpha channel as **v0.1.0-alpha.2**.

- Graphite/blue, square-corner identity, approved in the local preview (D10, DP04, F23); identity commit `7a8a6fa`.
- **Back to backup history**, **Back to vault** and **Back to all profiles**, preserving profile context and providing accessible keyboard return paths (F15, F16, F20, DP04).
- Snapshot comparison and Home/per-vault activity calendar plans (D14, DP05/DP06); these remain future features.
- Engine pin: `0f31eefe409cb4f0571baf65abd7d063784598cd` from `hoxsec/diskpond-core`.

## Verification

Passing local evidence is reused from the [identity review](graphite-blue-identity.md) and [navigation review](profile-history-navigation.md): frontend TypeScript/build, lint, focused helper tests and isolated keyboard/theme/zoom interaction checks. No backup engine, security, repository format, dependency or packaging code is changed by this batch.

The tagged **Windows release** workflow will run the compact release check: lint/types, unit tests, pinned-core Windows installer build, installed startup and bundled-engine backup/restore hash smoke, then source/license/checksum assembly and publication. This is the authoritative final GitHub run for the release-ready batch.

- [ ] Commit and push the full reviewed batch to `main`.
- [ ] Publish annotated tag `v0.1.0-alpha.2` at that application revision.
- [ ] Passing tag-triggered release checks and publication.
- [ ] Download release assets and verify all SHA-256 entries and installer/update version metadata.

Application revision, GitHub run, release URL and downloaded checksums will be recorded after those steps succeed. Full provider/platform/parity certification remains deferred under D13.
