# Snapshot comparison and retained backup activity

Date: 2026-11-03. Requirements: **D14, DP05, DP06**, supporting **F15 / F16 / F20 / DP04 / F23**.

Application baseline: `46fe56d` on `main`; this implementation is an uncommitted local batch. Latest published application remains `f872617` / `v0.1.0-alpha.2`. Core remains **`0f31eefe409cb4f0571baf65abd7d063784598cd`**. Windows x64, Node 24.14.0, pnpm 11.7.0, Electron 42.11.16.

## Delivered behavior

Release authorization: the owner requested committing/pushing this complete batch to `main` and publishing a new release. [v0.1.0-alpha.3](windows-alpha-3.md) tracks that authorized publication, superseding the uncommitted/authorization-pending notes below.

Latest owner correction (2026-11-03, DP06): removed the embedded vault calendar and hid Activity in compact vault navigation. The calendar now appears only in the separate Home-level Activity tab. This supersedes all earlier per-vault placement descriptions in this record. Passed `pnpm --filter @blinkdisk/desktop types`, `pnpm lint:ci` and `node scripts/smoke-history-ui.mjs`; evidence at `%LOCALAPPDATA%\Temp\opencode\diskpond-history-ui-b4Yekn`. The smoke checks no calendar on Home or vault pages, no Activity item in the vault menu, Home-level Activity entry and existing calendar/comparison interactions.

### Comparison

- **Compare backups** is available from source history and each snapshot's menu. Both selections are restricted to the same vault/device/user/path; the menu starts with its selected snapshot and a preceding complete-record candidate. Before/after order is explicit and can be swapped.
- Added, changed, deleted and unknown paths have before/after entry types, logical sizes and modification times. Object IDs detect content edits even when size/mtime are unchanged. Metadata is compared before skipping identical directory objects; names preserve stored case/Unicode and symlinks are never followed. Type replacements retain both types, with child additions/deletions where coverage permits.
- Exact byte counts accompany rounded large sizes; local timestamps also expose the stored timestamp precision. Root metadata gaps stay unavailable. The pin's `uploadFileWithCheckpointing` supplies exact historical size/mtime through a one-file summary when present; missing older/checkpoint summaries are not zero-filled.
- Failed directory reads never become empty folders or inferred deletions. Incomplete/unknown snapshot coverage suppresses unproven absence. Partial, canceled, missing-object, insufficient-history and no-differences states are distinct. Results are filterable and paged at 100 rows inside a keyboard-scrollable table.
- Comparison and snapshot browsing return to the same source history with device/user context; the existing **Back to vault** and **Back to all profiles** actions remain intact.

### Calendar

- The separate Activity tab aggregates available vault histories and supports a vault filter. Home has no calendar. Each vault has the shared calendar with device/user/source filters, initialized from the existing profile context.
- Reads enumerate sources, then request source-scoped snapshots with **`all=1`**, retaining repeated identical snapshots and deduplicating by snapshot ID within a vault. Lists and immutable directory objects have vault/source-scoped cache identities.
- Days group once by **local end/completion time**, with timezone and both start/end timestamps in chronological drill-down. Retained completed, partial, incomplete/canceled and unknown records are labeled from available evidence. Running/queued sources appear separately.
- Latest known failures/partial outcomes appear as separately labeled issue evidence on their end day. They are never added to snapshot totals or falsely matched by the unrelated outcome/snapshot IDs. An absent issue record does not mean no failures occurred.
- Loading, unavailable vaults/sources, deliberate limits and last-read timestamps remain visible. One unavailable vault does not erase other histories. Concise retained-history labels replace explanatory prose; empty days do not assert missed schedules.
- Month/Today controls and roving day focus support keyboard arrows, Home/End and Page Up/Down. Source-history drill-down preserves device/user context.

## Read and compatibility boundaries

No engine/API/persistence/cryptographic format change. Only read helpers and presentation/query state are added; existing mutation success and observed source-status changes invalidate relevant history caches.

- Four concurrent history reads globally; comparison processes at most two directory pairs at once.
- Read timeouts: 30 seconds per renderer request, two minutes per traversal or vault-history collection. Abort signals propagate through fetch, the Electron protocol and the authenticated HTTPS request. Changing pairs, leaving comparison or canceling abandons old results and queued reads.
- Comparison caps: 10,000 result rows, 100,000 queued paths, 5,000 directory objects, depth 256. Up to 100 affected locations are shown. Directory response validation caps entries at 100,000.
- Calendar caps: 200 sources and 20,000 snapshot records per vault, with explicit limited coverage. Source/list validation also bounds response counts. Visible history refreshes once per minute, on relevant local events, explicit Refresh and normal query refocus; it does not add per-source one-second polling.
- The directory browser shares the validated read helper and now retains raw file size; its cache includes the vault. Explicit `entries: null` is accepted only with an empty directory summary, matching the pinned Go encoder. Missing or malformed entries fail validation.

## Focused verification

| Check | Result |
| --- | --- |
| `pnpm types` | Passed across desktop, Electron and libraries. |
| Focused comparator, read-contract, calendar/date, transport and profile/source tests | Passed: **31 tests in six files** (command below). |
| `pnpm --filter @blinkdisk/electron test src/protocol.test.ts` | Passed: 16 tests, including cancellation forwarding and existing connection-interface guards. |
| `pnpm --filter @blinkdisk/electron build:frontend` | Passed: TypeScript, production renderer build and copied frontend. |
| `pnpm lint:ci`, `pnpm unused` | Passed. |
| `git diff --check` and local Markdown link-target review | Passed; all nine updated documentation files resolve their local link targets. |
| `node scripts/smoke-history.mjs` | Passed against the pinned real engine, two isolated local repositories and two profiles per repository. |
| `node scripts/smoke-history-ui.mjs` | Passed: both placements, filters, keyboard navigation, pair-change/cancel/retry, missing/large/insufficient states and table-height/overflow assertions. Light at 100%, Dark at 200%. |

Focused desktop command:

```powershell
pnpm --filter @blinkdisk/desktop test src/lib/snapshot-comparison.test.ts src/lib/history.test.ts src/lib/vault.test.ts src/lib/backup-activity.test.ts src/lib/profile.test.ts src/lib/source.test.ts
```

The native fixture requires the matching `pnpm build:core` output and installed Electron runtime. The UI fixture requires the current renderer stylesheet (`pnpm --filter @blinkdisk/electron build:frontend`). Both scripts retain their disposable evidence directories; neither uses the owner's repositories or active application profile.

### Disposable engine evidence

The runner creates only temporary repositories/configuration/cache/source/restore paths, connects them through the real managed native boundary, and exercises the production validated renderer reads/comparator with that authenticated transport. It checks the engine build pin. Each repository contains three directory snapshots (including repeated identical roots), two single-file versions and another profile's snapshot: **six retained IDs per vault**, **seven changed paths** in the A/B comparison, and no accidental root-ID deduplication.

Assertions cover unchanged nested/Unicode/empty data, additions/deletions, same-size/same-mtime content edits, metadata-only edits, file-to-directory replacement, identical-subtree skipping, supported single-file summaries, retained counts after engine restart, and a real missing-source failure that produces a latest outcome without an additional snapshot. Both directory versions are restored and the edited file's original bytes verified. This is scoped comparison/recovery evidence, not a full restore/platform certification rerun.

Final evidence is retained locally at `%LOCALAPPDATA%\Temp\opencode\diskpond-history-z4Lznn\evidence.json`. The environment denies ordinary file-symlink creation (`EPERM`); symlink comparison/no-follow behavior is covered by deterministic comparator fixtures, not claimed as a successful native file-symlink run.

### UI/data evidence

The isolated Electron UI fixture renders the actual Home, vault overview, comparison, source-history and snapshot-browser components with the production stylesheet and TanStack router/query stack. New history hooks/read validation/comparator run against fixture responses; legacy source/action hooks are isolated and unexpected writes throw. External HTTP(S) is blocked. It covers independent unavailable-vault history, repeated roots, unknown root-file metadata, partial and separately known failed outcomes, selector/filter/swap/browse/return flows, month/day keyboard navigation, cancellation, pair changes, retry, missing objects, insufficient snapshots and 250 additional long Unicode paths with pagination.

Unit fixtures additionally cover timezone/local-midnight/DST fallback and spring transitions, leap-day/month/year changes, retained ID deduplication across vaults, deletion/reload, source-scoped failure isolation, queue cancellation and traversal caps. Visual review found and fixed a flex-shrunk comparison table; the final UI run explicitly checks visible scroll-region height and overflow, in addition to DOM row counts.

The final passing UI run and visually reviewed captures are retained at `%LOCALAPPDATA%\Temp\opencode\diskpond-history-ui-T526Ka`: `home-calendar-light.png`, `comparison-filter-light.png`, `vault-calendar-dark-200.png`, `comparison-missing-dark-200.png` and `comparison-large-dark-200.png`. The latter confirms visible long-path rows inside the focusable scrolling table at 200%; metadata columns remain reachable through horizontal scrolling. The pair-change fixture explicitly selects Before when testing same-snapshot selection; changing an implicit default's After to the earliest snapshot correctly requires choosing a Before backup.

## Remaining scope

### Owner presentation follow-up

Moved the cross-vault calendar to `/$accountId/activity`, linked from the sidebar and compact navigation. Removed calendar legends/instructions and comparison explanatory panels; shortened status/error copy. Recorded the no-explanatory-prose preference in STYLE.md (D14 / DP05 / DP06 / DP04).

Final `pnpm lint:ci` and `git diff --check` passed. Reviewed the updated Activity Light and comparison Dark/200% captures.

Passed `pnpm --filter @blinkdisk/desktop exec vite build`, `pnpm types` and `node scripts/smoke-history-ui.mjs`. The updated smoke verifies Home has no calendar, enters Activity through the actual compact menu with keyboard at 200%, and repeats the existing calendar/comparison interaction checks. Latest captures: `%LOCALAPPDATA%\Temp\opencode\diskpond-history-ui-NdADzO`, including `activity-calendar-light.png`. Initial fixture runs required SVG loading for the real navigation logo and menu arrow-key navigation; the final run passed. Prior native evidence remains applicable because this follow-up changes presentation only.

- **Durable attempt history is deferred.** Full historic failure/cancellation accounting requires an owner-reviewed engine/persistence contract; the latest outcome field cannot supply it. No such contract was introduced here.
- Native file-symlink permission evidence, broad provider/platform/performance/accessibility certification and owner actual-use acceptance remain outstanding as documented scope.
- This batch is not committed, pushed, tagged or released. Owner preview feedback and separate release authorization are next.
