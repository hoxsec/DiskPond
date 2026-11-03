# M2 — Built-desktop two-version recovery

## Final Windows CI and M2 closure

**M2 complete, 2026-11-03.** [Run 41639380823](https://github.com/hoxsec/DiskPond/actions/runs/41639380823) passes in 16m40s at application `fb077fab4f7c63b107d81fcbc95f6bc509edae6c`, core `0f31eefe409cb4f0571baf65abd7d063784598cd`. This closes P01, F01–F02, basic F17/F22/F24 and DP01/initial DP03–DP04 for the Windows local-backup alpha. Earlier pending notes below are the chronological development record, superseded by this result.

- Clean install, lint, types, desktop tests, unused checks, core regressions, Windows packaging, discovery/password/provider fixtures, create/connect, development and installed NSIS smoke all pass.
- The owned 96-MiB VHD produces FAILED/SPACE for unpacked, ZIP and compressed ZIP restores. Each output is removable afterward; the volume is detached successfully.
- Scoped Windows firewall rules block non-loopback IPv4/IPv6 for Electron and core. Protected and session-only desktop journeys each pass two-vault/two-version create, backup, browse, restore and restart: sixteen verified restores total, including relative symlink targets, read-only attributes, Unicode/empty entries and file mtimes/hashes.
- Active-backup cancellation/termination, missing-storage retry, session-only credential re-entry, tray close/open/quit, owned-process cleanup and profile/registration isolation pass. No remote Chromium/main-fetch requests are observed.
- Runner: Windows build 26100, Xeon Platinum 8370C, 16 GiB RAM, Node 24.15.0, pnpm 11.7.0, Go 1.25.5. Observed initial backups 508–828 ms, incremental 618–961 ms, unchanged 293–302 ms, filtering 486–559 ms, restores plus comparison 1,067–2,450 ms. Electron checkpoints span 466,568–763,072 KiB; individual core checkpoints approximately 32–290 MB. App-data remains approximately 1.83 MB, with logs growing from 787 to 1,853 bytes across restart.

These measurements cover bounded fixtures. Full ACL preservation, long-duration profiling, live-provider breadth, all optional assets, update downloads and later-platform parity retain their M3–M6 gates. The installed smoke is startup/packaging evidence; recovery uses the production build in the isolated desktop harness. No binary release or tag was published.

2026-11-03. Requirements: **P01, F01, basic F02/F17/F24, DP01/DP03/DP04; Q01/Q02 and scoped Q08**. Initial slice published at `d585ed8` with core `dca6beb`; full-volume follow-up advances the core to published `0f31eefe409cb4f0571baf65abd7d063784598cd`.

Core follow-up `0f31eef` also closes restore output when copying fails or is canceled, preserving the primary copy error. The focused ZIP regression now includes a real local-file `Entry` restore with a destination that fails during writing and closing; it passes locally. This covers the second cleanup path that finalization-only testing missed.

With `0f31eef` rebuilt, `pnpm smoke:restores` passes real-engine file/directory/ZIP hash checks, failure/cancellation/interruption/restart outcomes and the isolated renderer result-component checks. `pnpm lint:ci` passes. Full-volume and offline certification still require the clean Windows runner.

## Compact acceptance check

`pnpm smoke:recovery` reuses the built-app keyboard driver with a fresh disposable profile and repository. Only native picker results are injected. Production renderer forms, routing, preload, persistence and the real engine perform create, source addition, two backups, snapshot browsing and four restores:

- Snapshot A: empty file, empty nested directory, nested Unicode path, a deleted-file candidate and a 32-MiB file.
- Snapshot B: change a file, delete the candidate and add another file.
- Restore A and B to separate empty destinations; require the exact renderer **Restore completed** status and compare SHA-256 hashes, complete directory entries and file modification times (whole seconds).
- Quit and restart the application; the exact whitespace-bearing password reconnects automatically. Browse and restore A and B again, with the same comparisons.
- Keyboard activation throughout; restore A in light theme and B in dark theme. Route re-entry uses saved source navigation, then keyboard activation of the actual snapshot links.

Remote Chromium HTTP(S)/WebSocket requests are blocked and counted during the journey. An initial run exposed jsDelivr/unpkg requests from the inherited Lottie player's WASM loader. The source-history page now uses the existing bundled Lucide icon; real progress remains unchanged. pnpm removed only the unused player dependencies. The final run observed **zero remote Chromium requests**, and all four restores passed.

## Checks

Windows x64, Node 24.14.0, pnpm 11.7.0, Go 1.25.5, pinned Electron 42.11.16.

```powershell
$env:DISKPOND_TEST_TMP = 'C:\Users\HOXSEC\AppData\Local\Temp\opencode'
pnpm build:desktop
pnpm smoke:recovery
pnpm unused
pnpm lint:ci
```

Build (including desktop/Electron type checks), recovery, dependency analysis and formatting/lint pass locally; `git diff --check` is clean. After replacing the animation, only `pnpm --filter @blinkdisk/electron build:frontend` needed repeating before the successful recovery run. The new smoke command is included in Windows CI; its clean CI result remains pending. No broad unit-suite rerun was needed for the icon/dependency change.

## Remaining gates

This is now actual desktop recovery evidence, rather than the earlier native/component-only fixture. It does **not** close M2. The fixture does not open the emoji picker or certify every optional UI asset offline. File permissions/ACLs and directory timestamps are not compared. Source publication is owner-authorized; no tag or binary release is included.

## M2 completion follow-up (in progress)

The expanded fixture adds two independent vaults/passwords, close-window/tray-open/tray-quit, owned-sidecar cleanup, theme persistence, 200% restore interaction, engine termination and missing-storage retry. It records initial/incremental/unchanged backup timing, 512-entry folder filtering, restore timing and Electron working-set observations. Its 32-MiB files now contain random bytes instead of highly compressible repeated bytes. Remote Chromium and main-fetch requests are observed from startup.

The missing-storage scenario found a production issue: `startVaultServer` ignored a confirmed reconnect error and returned a disconnected engine, sending the renderer into setup instead of retry. Startup now rejects that outcome, stops its child and preserves the failed/retry state. Localized copy explains storage availability. The focused server suite passes 25 tests, including returned reconnect errors as well as transport exceptions; desktop/Electron build and type checks pass.

`scripts/certify-m2-windows.ps1` is restricted to a disposable, elevated GitHub-hosted Windows runner. It provisions an owned 96-MiB VHD, reserves its free space down to approximately 1 MiB, and runs unpacked and both ZIP restore modes against actual insufficient space. It then blocks non-loopback IPv4/IPv6 for Electron and core with scoped firewall rules and runs the desktop recovery journey. Rules, previous firewall settings and the VHD are cleaned in `finally`. This privileged verification cannot run in the unelevated local session; CI results are required before closing the related gates.

Expanded local recovery **passes**: eight restores across two vaults and application restart, light/100% and dark/200%, close/open/quit via the actual tray callbacks, owned-child exit checks, persisted theme, engine termination, unavailable storage and successful retry after reattachment. The native IPC bridge and renderer issue real operations; task reads only confirm the unchanged-backup terminal state. No remote Chromium/main-fetch request was observed. Lint and PowerShell parsing pass.

Initial observations on Windows build 26200, Ryzen 7 7800X3D, 31.1 GiB available RAM, Node 24.14.0: initial backups 737–883 ms; incremental 795–930 ms; unchanged 177 ms; 512-entry filtering 227–278 ms; 32-MiB restores plus hash/metadata comparison 1,072–1,228 ms. These are UI-observed timings including polling/keyboard overhead, not isolated engine throughput. Summed Electron working sets at checkpoints ranged from 485,072 to 742,380 KiB. This short run does not establish long-term memory/cache/log bounds, core working-set peaks or broad performance parity.

Session-only follow-up: `pnpm smoke:recovery --session-passwords` passes locally with OS-storage failure injected only in the test entry point. Both vaults require the exact password and provider destination again after restart; the renderer explains that unattended backups cannot resume before reconnection. All eight restores still match. This mode is included in the privileged offline CI fixture.

Further local coverage passes active-backup cancellation (confirmed CANCELED task) and termination while RUNNING using a bounded 512-MiB random fixture file. Earlier A/B snapshots still restore byte-for-byte afterward and after restart. Read-only file attributes also round-trip. Symbolic-link creation is unavailable to this local unelevated user (EPERM); the elevated offline CI run requires the relative symlink fixture rather than skipping it.

Namespace checks place sentinel profiles at the pinned baseline's `blinkdisk` and `blinkdisk-dev` locations under isolated OS app-data. Their exact contents/entries remain unchanged. Existing `com.blinkdisk.app` and `io.github.hoxsec.diskpond` HKCU registrations are read before/after and remain unchanged. This verifies profile/registration separation, not simultaneous execution of an installed upstream binary.

Checkpoint observations after active-backup interruption: individual core working sets 31–271 MB after setup and 117–122 MB after restart/recovery (including the separate validation sidecar where present). Application data/cache totaled 1,830,029 bytes/54 files after setup and 1,831,827 bytes/57 files after restart; log bytes were 787 and 1,865 respectively. These are one bounded run's observations, not a leak/soak certification.

The repeated close/reopen journey also exposed an intermittent empty workspace before the renderer collection was ready. The account route now awaits descriptor hydration before rendering the workspace. The rebuilt session-only journey passes, including creation/source addition/backup at dark/200% for the second vault and all eight restores. Source link recovery still requires the privileged CI result.

The recorded `policy not found` issue was reproduced with an undefined disposable host policy: the definition endpoint returns `NOT_FOUND`, while `/policy/resolve` successfully returns the inherited effective policy. `use-policy.ts` already handles that code as an absent definition; `vault.ts` logs the error before the caller handles it. This is expected inheritance behavior in the reproduced case, not lost policy data. The original developer profile was not changed, and broader F08 policy certification remains M4.

## Full-volume CI finding and core correction

[Run 41635900243](https://github.com/hoxsec/DiskPond/actions/runs/41635900243), application `009da37`, passed lint/types/tests, packaging, native discovery/credentials/provider recovery and renderer create/connect. The real 96-MiB VHD then produced correct FAILED/SPACE outcomes for unpacked and uncompressed ZIP restore, but cleanup failed because the ZIP remained open. The inherited `ZipOutput.Close` returned immediately on archive-finalization error without closing the underlying destination. Core `945404f` always closes it and preserves the primary finalization error. A focused regression covers success, finalization failure, destination-close failure and both errors, and passes locally with `go test -tags testing -count=1 -timeout 60s ./snapshot/restore -run TestZipOutputClose`. The core fix is published before the application pin advances; no format/encryption change is involved. The corrected full-volume/offline CI run remains required.
