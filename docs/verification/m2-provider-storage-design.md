# M2 — Approved provider-credential storage and migration

Updated: 2026-11-03. **Owner-approved, implemented and locally verified on Windows; application and core changes remain uncommitted.** Application base: `main` at `d63593263db0a8f60b8b56240873a35b65009643`. Core base/gitlink: `e8955e7280edd9526b9f104f1592f233cfe6789b`, with local discovery and managed-storage changes. Requirements: **F24, F02, DP01, DP03**; supporting **F01, basic F17, F14 preservation and P10** evidence. Other provider certification remains M3.

The owner approved [hoxsec/diskpond-core](https://github.com/hoxsec/diskpond-core), Electron-owned OS-protected/session-only provider storage, and migration of both plaintext core connection JSON and inherited password-encrypted provider envelopes. This record supersedes the earlier proposal. Repository encryption/format and the future setup-export format are unaffected.

## Inherited lifecycle audit

| Operation | Inherited implementation and consequence |
| --- | --- |
| Form validation / discovery | Electron maps provider fields and posts to `/repo/exists`. The discovery fix reads format blobs without initializing or migrating them. Credentials still travel to the engine in the request. |
| Create / explicit connect | `internal/server/api_repo.go` calls `repo.Connect`, then `repo.Open`. `repo/connect.go` serializes the full `Storage.ConnectionInfo` before opening to verify the password. A failed open attempts disconnect/cleanup. Deleting the file after startup does not prevent this first plaintext write. |
| Reopen after restart | CLI/server initialization and `repo.Open` load the same connection JSON. `--no-persist-credentials` controls the repository-password strategy, not provider fields. |
| Description / profile | `SetClientOptions` loads and rewrites the connection file. Electron `src/profile.ts` reads its `username` and `hostname` directly, falling back to current OS identity if missing. |
| Bandwidth | `repo/open.go` installs a throttler update callback that reloads and rewrites the connection file. |
| Cache settings | `repo/caching.go` reads/writes that file, resolves relative cache paths and derives defaults from repository identity plus config path. |
| Disconnect / failed connect | `repo.Disconnect` loads the file to identify caches, removes local outcome/maintenance files and removes the connection file. These must remain local-only operations. |
| Other core paths | API-server connections and CLI `repository connect from-config` share local configuration APIs. A desktop-only mode must not silently reinterpret ordinary standalone CLI configurations. |
| Application's second provider copy | Renderer create/setup hooks call Electron's AES-GCM/PBKDF2 config helpers and persist `{iv,salt,cipher}` through the local SignalDB `config` collection. Setup decrypts this copy using the repository password. This is password protection, not OS-backed secret storage, and has its own selection by vault/profile and timestamp. |
| Password cache | The prior slice uses Electron OS protection or process memory and disables the engine's password-file fallback. The inherited CLI trims environment passwords; the managed API reconnect below avoids that path. |

Deleting plaintext files after startup, placing them in a temporary directory, or encrypting only on shutdown would still permit plaintext writes and crash leftovers. Changing only `repo.Connect` would miss later rewrites and reopening. Migrating only the core file would leave the inherited application provider envelope as another persistence path.

## Implemented boundary

1. **Electron owns saved connections.** `apps/electron/src/vault/connection.ts` protects the complete provider configuration in `connections.<vaultId>` using the existing native encryption/decryption round-trip, then verifies persisted readback. The session map is isolated by validated local vault ID. URLs, keys and service-account JSON stay inside this boundary. Rclone retains its separate remote credential store.
2. **Managed core configuration is metadata-only.** `--managed-storage` supplies a typed `repo.ConfigStore` through connect, verification, open, cache/client updates and disconnect. Provider settings stay in that store's memory. The same config filename retains username/hostname, description, cache settings and bandwidth values with `managedStorage: true`, without `storage`. Failed connection verification restores previous metadata. Ordinary standalone CLI config behavior remains inherited.
3. **Sidecars start disconnected.** Main passes the provider configuration and exact repository password over the authenticated, certificate-verified loopback API. `KOPIA_PASSWORD` is cleared, the core uses `passwordpersist.None()`, and no provider/repository secrets are placed in process arguments or temporary configuration files. Exact whitespace passwords now reopen automatically. Core update checks and raw file/content/repository logs are disabled in managed mode, including verification opens.
4. **Unavailable protection or failed saves use session memory.** Localized credential notices cover provider connections and vault passwords, re-entry after quitting, unattended-backup implications and cleanup failures. Unreadable protected records remain recoverable until credentials are re-entered. Neither locked ciphertext nor a failed decrypt is treated as an empty valid connection.
5. **Renderer access is narrow.** Named create/connect/unlock/discovery/summary methods validate payloads and main-window/frame/origin context; conflicting operations and existing-ID collisions are rejected. Raw protocol create/connect/discovery routes are blocked, including encoded paths. The legacy config collection and encrypt/decrypt helpers are no longer exposed through preload. Settings displays a sanitized field summary; query keys contain no passwords.
6. **Connection success is confirmed.** Main waits for a connected state or a terminal initialization failure before saving credentials. Unexpected engine exit becomes retryable; a late exit from an old child cannot remove its replacement. Provider errors are redacted before engine outcomes and main diagnostics, preserving error identities for handling.

Provider aliases and optional form values are retained, including omitted fields, explicit empty strings and false values. The existing profile reader continues reading the preserved non-secret metadata. A discovered bandwidth regression was fixed: `directRepository.ClientOptions()` now returns current throttler limits so a description update cannot overwrite them with startup values.

## Approved migration and recovery contract

- Only active local DiskPond vaults and their selected vault/profile envelopes are migrated. Other-profile envelopes are retained. Dormant hosted collections and BlinkDisk settings are not imported. Verification uses disposable profiles and repositories, preserving the developer profile.
- Legacy core JSON is limited to a regular, non-symlink file of at most 1 MiB and validated against supported provider/metadata fields. Unsupported metadata is left intact with a migration/cleanup failure rather than silently discarded. A protected, read-back connection or approved session-only copy is established before atomic replacement with metadata-only JSON. The replacement temporary file never contains provider fields.
- The inherited AES-GCM/PBKDF2 envelope format is retained for reading: 12-byte IV, 16-byte salt, 100,000 PBKDF2/SHA-256 iterations and the existing 10,000-character ciphertext bound. Bounds and record shapes are checked before decryption/sorting. Invalid or unreadable records remain on disk with re-entry/cleanup status; manually supplied credentials can restore access without claiming those records were cleaned up.
- Selected envelopes are removed only after confirmed connection. SignalDB cleanup waits for all queued writes (`persistence.pushCompleted`) and verifies removal by reading the persisted collection. Atomic-write/readback failures retain visible cleanup status and reload persisted records for retry. Core-file, protected-store and envelope cleanup failures are tracked separately.
- Profile identity, cache settings and both bandwidth limits are preserved. Repository format blobs, policies and snapshots are not migration targets. Session-only migration intentionally requires credential re-entry after quitting.
- The modified standalone core rejects a managed config with `ErrManagedConnection`. Older clients have no provider configuration to reopen; automatic downgrade/reconstruction of plaintext settings is not implemented. Older application downgrade is unverified and must not be used as a recovery procedure.

## Verification and reproduction

Windows 11 x64; Node 24.14.0 locally (repository/CI pin 24.15.0), pnpm 11.7.0, Go 1.25.5, Electron 42.11.16. The candidate reports `e8955e7280edd9526b9f104f1592f233cfe6789b-dirty` from `hoxsec/diskpond-core`. See [DEVELOPMENT.md](../../DEVELOPMENT.md) for the Corepack PATH shim and `GO_BINARY` override used locally.

```powershell
# From apps/core, with Go on PATH:
go test -tags testing -count=1 -timeout 180s ./repo ./repo/blob/throttling ./internal/server -run 'TestManaged|TestLocalConfig|TestThrottler|TestRepoExistsDoesNotModifyStorage'
# From the application root:
pnpm test
pnpm types
pnpm lint:ci
pnpm unused
pnpm build:desktop
$env:DISKPOND_TEST_TMP = 'C:\Users\HOXSEC\AppData\Local\Temp\opencode'
pnpm smoke:providers
pnpm smoke:passwords
pnpm smoke:discovery
pnpm smoke:desktop
pnpm smoke:desktop --session-passwords
```

| Check | Observed result |
| --- | --- |
| Core managed/local-config/throttling/discovery selection | Pass. Wrong-password and verification failure preserve prior state; metadata/cache/bandwidth updates survive reconnect; unmanaged reopening is rejected; provider errors retain error identity after redaction. |
| `pnpm test` | Pass: **572 tests / 54 files**, including **206 Electron tests / 19 files**. Covers persistence failures/retry, malformed/bounded legacy input, renderer isolation, IPC/protocol bypasses, terminal connection handling and unexpected-child-exit recovery. |
| `pnpm types` | Pass across desktop/Electron/libraries. |
| Lint / dependency analysis | `pnpm lint:ci` passes **694 files**; `pnpm unused` passed for this slice. |
| `pnpm build:desktop` | Pass: owned candidate core plus production renderer, main/preload and copied frontend. |
| `pnpm smoke:providers` | Pass: **12 phases / 44 terminal-success restore/hash comparisons**. Includes per-repository provider authorization, wrong/swapped-credential rejection, both legacy migrations, protected post-migration restart, all failure/session modes and live/post-exit credential scans. |
| `pnpm smoke:passwords` | Pass on the final managed core: **seven phases / three independent vaults**, including exact-password automatic reopening, failure/re-entry and interruption/reconnect. |
| `pnpm smoke:discovery` | Pass on the final managed core: **24 requests / eight unchanged destinations / eight versioned restore/hash comparisons**, using the retained clean baseline executable. |
| `pnpm smoke:desktop` and `--session-passwords` | Both pass against the final production build: protected/session notices, settings/theme persistence, keyboard/zoom flow, IPC rejection and empty-destination discovery; zero remote renderer/main-fetch requests in the exercised flow. |
| Workflow / source hygiene | `actionlint` passes the updated Windows workflow; application/core `git diff --check` and changed-core `gofmt -l` pass. Local document links checked. |

### Native provider fixture

`scripts/smoke-provider-storage.mjs` builds a loopback-only Go WebDAV service and an Electron test entry point using the real main/engine modules. Each repository path requires its own provider account. Two vaults use distinct provider and repository passwords, including exact Unicode/whitespace passwords. Four create/restart pairs exercise real native Windows protection plus injected unavailable protection, encryption failure and protected-store write failure. Additional phases seed both legacy storage forms, migrate them, restart with protection, then reopen with a locked store.

Each create builds versions A and B, changing, adding and deleting files; nested Unicode data and an empty directory are included. After engine/application restarts, both versions restore to separate destinations. Every restore must reach `SUCCESS` with `ignoreErrors: false` and full-depth options before file SHA-256 hashes and directory entries are compared. Wrong provider passwords, the other vault's provider account, and wrong repository passwords must fail without saving those credentials. Migration checks preserve username/hostname, resolved cache location and both bandwidth limits, remove the selected legacy envelopes, and retain another profile's envelope.

Live scans cover fixture profiles, repository storage, caches, logs and temporary files for known fixture secrets in plaintext UTF-8, UTF-16LE and base64 and reject engine password files. Windows-locked files are deferred during operation and required in strict post-exit scans. Captured Electron/engine output is checked before printing. The intentional plaintext legacy seed is scanned only after migration. These scans do not establish secure erasure of historical filesystem blocks, crash dumps or OS swap.

Fixture development caught live Windows file locks, inherited shallow-restore defaults, normalized relative cache paths and a reused destination in the extra restart phase. The harness now requires post-exit scans, explicitly requests full-depth restores, compares resolved cache locations and uses a separate destination per phase/version. The bandwidth-loss issue was a product regression and is covered by the core lifecycle test.

The final built-smoke captures were reviewed in light/dark mode: the single credential notice includes provider details and re-entry/scheduling guidance, with readable shared semantic colors. The 200% layout stacks controls with scrollable content. Captures are retained locally under `diskpond-m2-provider-captures/{protected,session}` in the approved temporary directory. Full screen-reader and provider-form accessibility certification remain open.

## Remaining gates

- Full M2 renderer create/backup/history/restore with networking blocked, truthful restore terminal outcomes, explicit create/connect UX and review of connection's inherited repository migration remain open. This native fixture is not the desktop recovery journey.
- Full F24 damaged-state/upgrade/downgrade coverage, sustained interruption/retention/maintenance behavior and diagnostic export remain later gates. Credential cleanup failures are surfaced; arbitrary damaged collection repair is not implemented.
- WebDAV loopback evidence does not certify live WebDAV services, S3/B2/GCS/Azure/SFTP/Rclone credentials or macOS/Linux native stores. Full provider/platform matrices remain open.
- The Windows workflow includes managed-core and provider checks, but this uncommitted slice has no clean-clone CI or installed-artifact result. Modified core source must be published and the gitlink advanced before clean CI can reproduce it. Existing installer artifacts and published CI certify the earlier branding/workspace slice.

Related evidence: [password storage](m2-password-storage.md), [read-only discovery](m2-read-only-discovery.md), [provenance](../../UPSTREAM.md). No commit, push, tag or release is part of this verification handoff.
