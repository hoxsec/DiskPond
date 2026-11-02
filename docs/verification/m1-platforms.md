# M1 — Initial platform compatibility findings

Date: 2026-11-02. Requirements: F22–F26, DP01/DP04; all declared platform targets remain in PLAN.md.

| Target | Source evidence | Runtime evidence / gap |
| --- | --- | --- |
| Windows 10/11 x64 | Upstream README; Electron 42.11.16 Windows x64 asset; Go 1.25 Windows baseline is Windows 10 / Server 2016 or later | Built core and Electron desktop on Windows 11 Pro x64, version 10.0.26200. Windows 10, clean installs, upgrades and release signing remain untested. |
| macOS Intel/Apple Silicon | Inherited universal DMG/ZIP configuration; Electron 42.11.16 provides darwin x64/arm64 assets | **Confirmed minimum-version conflict:** both Electron 38+ and Go 1.25 require macOS 12 Monterey; the pinned README advertises Big Sur (11). No silent narrowing of DiskPond's scope. Resolve with the owner at M6 before claiming support. |
| Linux x86_64/arm64/armv7l | Inherited AppImage/DEB/RPM configuration; Electron 42.11.16 release includes all three Linux assets; Go ARM builds map to `GOARCH=arm` | Availability of archives is not execution evidence. Distro/glibc baselines, Node build tooling, ARMv7 hardware, helpers and all package formats require M6 verification. |

Pinned Electron evidence:

- [Breaking changes at v42.11.16](https://github.com/electron/electron/blob/v42.11.16/docs/breaking-changes.md): “Removed: macOS 11 support,” macOS 12+ required since Electron 38; Windows 7/8/8.1 support removed since Electron 23.
- [Release v42.11.16](https://github.com/electron/electron/releases/tag/v42.11.16): inspected win32-x64, darwin-{x64,arm64}, linux-{x64,arm64,armv7l} artifact availability.
- [Go 1.25 ports](https://go.dev/doc/go1.25#ports) and [minimum requirements](https://go.dev/wiki/MinimumRequirements).

The native core build wrapper maps Windows x64, macOS x64/arm64 and Linux x64/arm64/ARM to inherited resource directory names and rejects unsupported combinations. Only Windows x64 has execution evidence. It does not assemble a universal macOS binary; the pinned Makefile's `lipo` step remains necessary for future macOS packaging. Root Windows packaging currently requires Windows x64 explicitly.

Rclone, SSH key scanning, snapshot mounting, OS-protected secrets, UNC/network drives, filesystem metadata and cross-device profiles still require their own real target tests. No mount driver or bundled Rclone is implied by the packaged engine.
