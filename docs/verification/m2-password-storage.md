# M2 slice — Protected vault passwords and session-only fallback

Initial verification: 2026-11-02; updated 2026-11-03. Based on `main` at `d63593263db0a8f60b8b56240873a35b65009643`; implementation is uncommitted. The initial checks below used the unchanged core at `e8955e7280edd9526b9f104f1592f233cfe6789b`. Final integration checks use the same gitlink with local [discovery](m2-read-only-discovery.md) and [managed-provider storage](m2-provider-storage-design.md) changes.

## Scope

This implements the **vault-password portion of F24/DP01** on Windows, with supporting **F02/DP03** checks. Provider storage has separate evidence linked above. Complete F24, desktop recovery and other operating systems remain unverified; M2 is open.

- Electron saves a vault password only after OS-backed encryption and a successful decryption round-trip. It never enables `basic_text` or creates a `PLAIN` cache entry. Linux requires a recognized keyring backend; unavailable, unknown and basic-text backends are rejected.
- Failed/unavailable protection or cache writes switch new saves to process-memory storage for the remainder of that run. A persistent, localized notice explains password re-entry after quitting and the dependency of unattended backups on reconnecting. Settings includes recovery guidance; create-vault dialogs include the same degraded-mode notice.
- Existing encrypted values retain their format. Unreadable/damaged values produce password re-entry rather than crashing startup or being treated as an unlocked password.
- Before starting each active local vault, legacy `PLAIN` values and base64 `.config.kopia-password` / `.config.blinkdisk-password` files are moved into protected storage or memory, then their unprotected copies are removed. Failed removal, oversized/special paths and malformed legacy files remain visible as cleanup problems. Dormant hosted records and other application profiles are not scanned, decrypted or imported.
- Password IPC validates payloads, local-vault membership, the main-window/main-frame sender and frontend origin. The inherited settings bridge now exposes only presentation preferences and cannot read/write password records or dormant hosted state; its unused whole-store-clear method is removed.
- All sidecars receive `--no-persist-credentials`. With the subsequent managed-provider integration, they start disconnected with `KOPIA_PASSWORD` cleared and receive the exact unlocked password over the authenticated loopback API. Missing credentials leave setup/re-entry available without an indefinite initial Open retry.
- Re-entered connections are tracked for shutdown. Status polling stops with the child and backs off after request failures. Chunked stderr authentication lines are buffered and excluded from diagnostics even when a diagnostic shares their chunk.

Repository encryption is unchanged. The inherited provider-config envelope is now read only for the approved provider migration; this is not the M5 setup-export format.

## Initial verification and reproduction

Windows 11 Pro x64 build 26200; Node 24.14.0, pnpm 11.7.0, Electron 42.11.16, pinned Windows core. Repository/CI Node pin remains 24.15.0. Every repository/cache/settings destination in these checks is disposable and isolated under `DISKPOND_TEST_TMP`.

```powershell
$env:DISKPOND_TEST_TMP = 'C:\Users\HOXSEC\AppData\Local\Temp\opencode'
$env:TURBO_TELEMETRY_DISABLED = '1'
pnpm install --frozen-lockfile
pnpm types
pnpm --filter @blinkdisk/electron test
pnpm lint:ci
pnpm unused
# Uses the existing pinned core build; run pnpm build:core on a fresh checkout.
pnpm --filter @blinkdisk/electron run prebuild
pnpm smoke:passwords
pnpm smoke:desktop
pnpm smoke:desktop --session-passwords
```

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; dependency lockfile unchanged. |
| `pnpm types` | Pass across desktop, Electron and applicable libraries. |
| `pnpm test` | Pass: **532 tests / 51 files**, including **166 Electron tests / 16 files**. |
| `pnpm lint:ci` | Pass: **682 files**. Subsequent focused formatting/test checks cover the reviewed UI/log-buffer adjustments. |
| `pnpm unused` | Pass; the dynamically bundled native-fixture entry and Electron-workspace build dependencies are explicitly identified for analysis. |
| Electron `prebuild`, final `build:frontend` / `compile:prod` refreshes | Pass; production renderer/main/preload and copied locale assets rebuilt against the existing pinned core binary. |
| `pnpm smoke:passwords` | Pass: all seven native fixture phases below, with three repositories per phase. |
| `pnpm smoke:desktop` | Pass: protected-mode Settings, preference persistence, new IPC rejection checks and inherited built-app smoke. |
| `pnpm smoke:desktop --session-passwords` | Pass: unavailable-storage notice, backup/re-entry guidance, theme/keyboard/zoom flow and IPC rejection. |
| Documentation / source hygiene | 29 local links validated; `git diff --check` passes; core checkout clean at the original pin. |

Expected negative checks print fixed `Invalid preference request` / `Invalid password request` IPC errors. The initial fixture also printed wrong-password and unavailable-password prompt errors before cancellation; managed startup now avoids that prompt. No fixture passwords appeared. Inherited Vite plugin notices remain informational.

### Final managed-startup verification — 2026-11-03

- `pnpm build:desktop` passed with the owned `-dirty` core and production renderer/main/preload.
- `pnpm smoke:passwords` passed all seven phases and three independent repositories, including automatic reopening of the exact whitespace-bearing password.
- `pnpm smoke:desktop` passed protected-mode settings, preference persistence, IPC rejection and nonmutating discovery; zero remote renderer/main-fetch requests in the exercised flow.
- `pnpm smoke:desktop --session-passwords` passed the single localized credential notice, re-entry/backup guidance, settings/theme/keyboard/zoom flow and IPC rejection. Current combined test/lint/type/provider results are recorded in the [provider-storage evidence](m2-provider-storage-design.md); the earlier counts above are historical, not the current suite totals.

### Native credential/reconnect fixture

`pnpm smoke:passwords` builds a test-only entry point against the actual Electron password/engine modules. It creates three independent encrypted local repositories with distinct Unicode passwords, including one with leading/trailing whitespace, and runs separate Electron processes for creation and restart.

Observed passing scenarios:

1. Native Windows OS protection saves and unlocks passwords after application restart; all three passwords automatically reopen the correct repository with managed startup.
2. Injected unavailable protection and encryption failure retain passwords only in memory. After application restart the cache returns no password, the engine is disconnected with no lingering initialization task, wrong-password connection fails with `INVALID_PASSWORD`, and correct password re-entry reconnects.
3. Previously protected records with a newly unavailable key store require re-entry and reconnect successfully.
4. Forced engine termination and same-desktop-session reconnect work in protected and session-only modes. Each child is terminated before fixture cleanup.
5. Exact whitespace passwords reconnect through the API without alteration. Managed startup now also uses this API, closing the initial automatic-reopening gap caused by CLI environment-password trimming.
6. A recursive scan of the fixture profiles, repositories, caches and logs finds no plaintext or base64 copies of the fixture passwords and no engine password files. Windows-native protection is real; unavailable/failure/locked key-store states are injected in the test entry point, not exposed as application configuration.

Fixture development caught two harness errors, corrected before the passing run: repository IDs must supply at least 16 salt bytes, and `KOPIA_CACHE_DIRECTORY` must be distinct per vault rather than shared between repositories. An initial top-level await prevented Electron's ready event and was replaced with a ready callback. These failed attempts are not acceptance evidence.

### Regression and UI checks

Unit coverage exercises protected/session-only round-trips, restart memory loss, distinct vault passwords, rejected Linux backends, OS encrypt/decrypt/mismatch failures, cache write/delete failures, malformed and unreadable records, local-only legacy migration, malformed legacy-file preservation, unsafe IDs, sender/frame/origin rejection, settings-bridge bypass attempts, chunked credential redaction, startup cancellation and connected-child cleanup.

Built desktop smoke exercises the session-only notice and scheduled-backup implication, rejects password/settings IPC bypasses, and retains account-free keyboard onboarding, dialog focus return, theme changes, 200% navigation/scrolling and local settings persistence. The final session-only smoke also asserts exactly one password notice on Settings after correcting the layout's route detection. Visual review of the final `session/settings-light.png` and `session/settings-dark.png` captures confirms the single notice and readable re-entry/recovery guidance; `session/settings-200-percent.png` and `session/about-200-percent.png` show stacked controls and reachable content through scrolling. Captures are retained locally under `diskpond-m2-password-captures` in the approved session temporary directory. The notice uses semantic card/text colors and a text/icon status; full screen-reader certification remains open.

The password fixture and session-only built smoke are added to the Windows workflow. They have not been run on CI for this uncommitted slice. The completed [main CI run](https://github.com/hoxsec/DiskPond/actions/runs/41531861201) certifies the earlier published branding/workspace slice only.

## Remaining blockers and limits

- **Provider storage has separate integration evidence.** The [approved provider-storage slice](m2-provider-storage-design.md) replaces active desktop plaintext core configuration and inherited provider envelopes with protected/session-only connections. Ordinary standalone core configuration remains inherited; full provider/OS certification remains open.
- **Discovery was mutating in this slice's baseline.** Subsequent [owned-core changes](m2-read-only-discovery.md) remove discovery writes and add compatibility/restore evidence. Explicit safe create/connect separation remains open.
- This password fixture confirms repository opening and credential isolation. Separate discovery/provider fixtures now verify versioned restore hashes. Q01's complete desktop journey, truthful renderer restore terminal outcomes, broader interruption/engine supervision, retention and network certification remain M2/M3/M4 work.
- Full damaged-state recovery and live macOS/Linux key-store behavior remain open. Unit-simulated Linux backends are not platform certification.
- Existing protected native-keyring records are not enumerated or deleted; the engine no longer reads or writes them. Cleanup failure leaves an explicit warning that an old unprotected copy may remain.

The owned development runner was stopped for production compilation; its `%APPDATA%\diskpond-dev` profile was preserved and was not used as a test fixture. Its later exit-code-1 notification is expected after that deliberate stop. Before exiting, the preview renderer logged `Core error: [NOT_FOUND] policy not found`. This is an unverified observation from the preserved developer profile, not recovery evidence; any investigation must reproduce it with disposable fixtures.

Existing installer/win-unpacked snapshots still identify the earlier branding/workspace build; this slice has not been packaged, committed, pushed, tagged or released.
