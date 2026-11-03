# M2 — Built-desktop two-version recovery

2026-11-03. Requirements: **P01, F01, basic F02/F17/F24, DP01/DP03/DP04; Q01/Q02 and scoped Q08**. Initial slice published at `d585ed8`; core remains `dca6bebcba9c50f6f2658ae3662a52414f77bcf9`.

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
