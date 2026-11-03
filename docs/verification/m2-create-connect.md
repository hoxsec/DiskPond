# M2 slice — Explicit create and connect

2026-11-03. Requirements: **P01/F02**, supporting **F03/Q02** and setup **Q08**. Application base: `bf4c6c2b10eadd593c7f352a52b41ba7fd5578fe`. Core base: `aad67c688a05ce119859d49ca51bdf67787f0b99`; the initialization guard is now published on core `main` and pinned at [`5971b879111001ba4c8d0e41659723d79565f06d`](https://github.com/hoxsec/diskpond-core/commit/5971b879111001ba4c8d0e41659723d79565f06d). Local checks below used the same source before commit (`aad67c6…-dirty`). Original compatibility baseline: `blinkdisk/core@e8955e7280edd9526b9f104f1592f233cfe6789b`.

## Behavior

- Empty workspace, vault list and vault menu expose **Create a new vault** and **Connect an existing vault**. Provider forms are shared, but their intent and native operations remain distinct. Neither action falls back to the other.
- Creation requests a new password and confirmation. Connection requests the existing password, preserves exact spaces, and explains the inherited legacy-metadata copies. Recoverable errors retain entered fields. English loading/error text, step/error focus, focus return and busy navigation guards are present.
- Main repeats discovery immediately before creation/connection. Local creation requires an accessible, existing empty folder; a selected missing directory is not implicitly created. Empty/unrelated connection targets, malformed repositories, inaccessible folders, incorrect passwords and duplicate identities have actionable states.
- Identity checks run in main against active descriptors and in-flight/live connections, before a writable connection. New-vault IPC operations are serialized even across different local IDs. Main returns the verified repository identity for local persistence; the renderer no longer guesses it or saves the password again.
- The engine's `format.Initialize` checks for **any existing blob**, stops at the first, and fails on listing errors. This closes the inherited legacy-only/orphaned-data hole in its current-format-blob guard. Local directory checks additionally reject unrelated files that a sharded blob listing would ignore. Existing format/encryption algorithms are unchanged.
- The creation IPC schema rejects IDs shorter than the engine's 16-byte salt minimum. A deliberately short fixture ID exposed this inherited boundary gap; real generated vault IDs are longer.

## Legacy connection review

The existing core authenticates the password before `MigrateLegacyBlobIDs`. The fixture copies baseline-produced repositories, uses legacy central-blob names and the legacy tool URL, then records the whole file tree, file modes, sizes, modification times and SHA-256 hashes before and after explicit native connection. Scheduled maintenance is disabled on the disposable baseline before copying to isolate migration writes.

| Copy | Writes during connection |
| --- | --- |
| Current names | None |
| Current names, absent `.shards` | None |
| Legacy names | Adds `kopia.repository.f` and `kopia.blobcfg.f` |
| Legacy names, absent `.shards` | Adds the two current-name blobs and `.shards` |

Existing blobs, including both legacy blobs, remain unchanged. The new repository blob rewrites only `https://github.com/blinkdisk/core` to `https://github.com/kopia/kopia`; the blob configuration is copied byte-for-byte. Wrong passwords and rejected creation produce no repository writes. Both baseline snapshot versions remain recoverable with the candidate and original pinned client after migration. This reviews the inherited behavior; it does not introduce a new repository format or claim every historical release is compatible.

## Fixtures and checks

Windows 11 x64; Node 24.14.0 (supported local minimum; CI pin 24.15.0), pnpm 11.7.0, Go 1.25.5, Electron 42.11.16. All paths are disposable under `DISKPOND_TEST_TMP`; the developer profile is preserved.

```powershell
pnpm install --frozen-lockfile
pnpm --filter @blinkdisk/electron --filter @blinkdisk/desktop --filter @blinkdisk/schemas --no-bail -r test
pnpm types
pnpm lint:ci
pnpm unused
# In apps/core, with Go on PATH:
go test -tags testing -count=1 -timeout 120s ./repo/format
go test -tags testing -count=1 -timeout 180s ./repo ./internal/server -run 'TestManaged|TestRepoExistsDoesNotModifyStorage'
# In the application root:
pnpm build:desktop
pnpm smoke:discovery
pnpm smoke:vaults
pnpm smoke:providers
pnpm smoke:passwords
pnpm smoke:desktop
```

| Check | Result |
| --- | --- |
| Frozen install | Pass; dependency lockfile unchanged. |
| Affected package Vitest suites | Pass: 521 tests (217 Electron, 284 desktop, 20 schema), followed by the added identity-release regression and focused final management/IPC run. Includes native intent guards, duplicate identity reservations/retry, persisted duplicates and invalid creation IDs. |
| Format package | Pass; legacy markers, orphaned blobs, unrelated blobs and listing failures are rejected without modifying existing map-storage data; existing format/retention tests pass. |
| Managed lifecycle and nonmutating discovery core regressions | Pass. |
| Build/type/lint/dependency checks | Pass: production desktop/core build, `pnpm types`, `pnpm lint:ci` (697 files), `pnpm unused`, workflow `actionlint`, and whitespace checks. |
| Extended native discovery/recovery | Pass, including legacy-tool-URL rewrite assertions. 24 nonmutating discovery requests; native guards and two new independent vaults; 32 restore/hash comparisons across native initial/restart, candidate CLI and original-client post-migration paths. |
| Built renderer create/connect | Pass: keyboard setup, error focus/return, Windows denied-ACL destinations, stale-discovery protection, wrong-password retry, duplicate rejection, light/dark details, 200% zoom and three-vault restart. The ACL fixture exposed unreadable-empty storage being classified as uninitialized; checking directory access for both intents fixes it. |
| Password/provider and built-startup regressions | Pass: all seven password phases; credential-isolated WebDAV protected/session/protection-failure/write-failure/migration/locked scenarios and versioned restore hashes; built startup/onboarding/retired-IPC checks. |

`pnpm smoke:vaults` launches the actual production renderer/main/preload twice. It injects only native picker results, uses Tab/Enter for forms, checks both entry points, rejects occupied/empty/unrelated/missing/corrupt/denied destinations, retries a wrong password without clearing the name, and checks duplicate prevention. It inserts a file **after discovery** to verify the final native create guard. Two newly created vaults use distinct whitespace-bearing passwords; a third connects to a separately initialized repository. All three reopen after application restart. It exercises light/dark details and keyboard retry at 200% zoom. Optional captures use `DISKPOND_SMOKE_CAPTURE_DIR`.

`pnpm smoke:discovery` still compares all 24 discovery results and unchanged inventories. It now also calls native create/connect, inventories successful legacy writes, restores two baseline versions through the real API, restarts Electron with protected credentials, and verifies new-vault recovery. Candidate CLI and original baseline client independently restore the copied versions. All restore assertions require a terminal `SUCCESS` and exact file hashes/directory entries; they bypass the still-unfixed renderer restore coordinator.

## Source publication and Windows CI

The owner authorized committing and pushing the verified application/core pair on 2026-11-03. Core `5971b879111001ba4c8d0e41659723d79565f06d` was pushed first; this application handoff advances the gitlink and includes the extended Windows workflow. Clean Windows CI is pending, so packaging/installed evidence for this slice remains unverified. No tag or binary release accompanies the source handoff.

## Remaining gates

- Clean Windows CI must pass on the published application/core pair before closing the create/connect reproducibility gate.
- TODO item 2 (truthful renderer restore outcomes) and item 3 (full offline renderer backup/two-version recovery) remain open. Native API/CLI hashes and setup UI success do not close Q01 or M2.
- Live providers, other platforms, external-client concurrent initialization, interrupted legacy migration, link/ACL restoration and complete assistive-technology/contrast certification remain outside this evidence. The engine's list-before-initialize check is not a provider-wide atomic transaction between independent clients.
