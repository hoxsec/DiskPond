# Vault available space — local verification

Date: 2026-11-03. Requirements: **F06 / P01–P03 / DP04**. This owner-requested follow-up is published in **v0.1.1**. [Release verification](windows-v0.1.1.md).

## Behavior

- The vault overview shows **Storage available** alongside protected data, files and directories, including immediately after creating or connecting an empty vault.
- Local, external and OS-mounted network destinations (including legacy filesystem/NAS aliases) resolve through the native-owned filesystem connection. The reading is the current user's available space on that destination volume/share, shared with other vaults and files on the same storage. It is not a per-vault reservation or logical protected-data measurement.
- Native `statfs` uses `bavail × bsize`, with integer/range validation. Missing, inaccessible or timed-out destinations show **Unavailable**; genuine zero remains **0 B**. Non-filesystem providers currently show **Not reported**.
- The query is keyed by vault, runs independently of internet connectivity, refreshes every 30 seconds while the overview is active and on return/focus, and clears the displayed number on a failed refresh. It uses the existing size formatter. No storage trend/history is invented.
- The cards stack at narrow widths and use the shared Light/Dark tokens.

The IPC accepts only an active local vault ID from the main desktop frame. Electron resolves its saved destination; no arbitrary renderer-supplied path or credentials are exposed. The read-only probe runs in a hidden child using Electron's Node runtime, with a 5-second kill deadline, 1 KiB output limit, at most two concurrent probes and shared in-flight reads for the same path. It does not initialize or modify repositories.

## Checks

Environment: Windows x64, Node 24.14.0 (documented local minimum), pnpm 11.7.0, Electron 42.11.16. The unchanged pinned core `0f31eefe409cb4f0571baf65abd7d063784598cd` was reused by create/connect smoke. Commands below used the cached pnpm 11.7.0 launcher because `pnpm` was not on this shell's PATH.

| Command | Result |
| --- | --- |
| `pnpm --filter @blinkdisk/electron exec vitest run src/storage-space.test.ts src/vault/connection.test.ts src/vault/connection-ipc.test.ts` | **39 tests passed**: zero/invalid/native-error results, bounded/deduplicated reads, retry, path argument handling, real disposable filesystem reads, saved connection restart, missing/locked/unsupported connections and IPC frame/payload/active-vault enforcement. |
| `pnpm --filter @blinkdisk/desktop --filter @blinkdisk/electron --filter @blinkdisk/schemas -r types` | Passed. |
| `pnpm --filter @blinkdisk/desktop build`, `node scripts/copy-frontend.mjs`, `node esbuild.config.mjs production` (last command in `apps/electron`) | Passed: renderer, copied frontend, main and preload. Existing Vite plugin/chunk-size notices remain. |
| `node scripts/smoke-history-ui.mjs` | Passed: actual overview component and query, vault-switch isolation, unsupported/zero/unavailable/error/recovery states while Query's online manager is offline, Light/Dark and 200% responsive layout. |
| `pnpm smoke:vaults` | Passed both setup and restart: two newly created vaults and a connected existing vault report native available bytes matching their disposable destination volume; all three still display the card after restart. Also retained the existing keyboard/create/connect/error checks. |
| `pnpm lint:ci`, `git diff --check` | Passed; Biome checked 738 files. |

Native create/connect screenshots were reviewed at `%LOCALAPPDATA%/Temp/opencode/diskpond-storage-space-20261103-b7d4/vault-storage-{light,dark}.png`. Reviewed component captures include `vault-storage-light.png` and `vault-without-calendar-dark-200.png` under `%LOCALAPPDATA%/Temp/opencode/diskpond-history-ui-JsoYYl/`; the final offline-state run retained equivalent captures in `diskpond-history-ui-8wjbHE/`.

## Scope

Real reads and create/connect/restart were exercised on disposable local Windows directories. Physical USB removal, live UNC/NAS quota behavior, other OSes and provider-specific remote quota APIs remain deferred. The fixed deadline/concurrency policy is regression-tested; no live stalled NAS was available. No repository format, engine source, credential format or dependency change is included.
