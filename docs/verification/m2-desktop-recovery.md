# M2 — Built-desktop two-version recovery

2026-11-03. Requirements: **P01, F01, basic F02/F17/F24, DP01/DP03/DP04; Q01/Q02 and scoped Q08**. Based on application `b5ba71f`, with uncommitted follow-up changes; core remains `dca6bebcba9c50f6f2658ae3662a52414f77bcf9`.

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

This is now actual desktop recovery evidence, rather than the earlier native/component-only fixture. It does **not** close M2: all-process OS-level network blocking, multiple-vault recovery in this journey, link/permission metadata, 200% zoom, BlinkDisk coexistence, interruption/lifecycle and sustained performance remain open. Chromium interception starts at the loaded window; it is not a startup/main-process/core traffic audit. The fixture does not open the emoji picker or certify every optional UI asset offline. File permissions/ACLs and directory timestamps are not compared. The real full-volume restore failure remains blocked as recorded in [restore outcomes](m2-restore-outcomes.md). No source, tag or binary was published in this session.
