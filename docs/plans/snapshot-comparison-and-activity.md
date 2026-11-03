# Snapshot comparison and backup activity calendar

Date: 2026-11-03. Status: **planned; implementation has not started**. Decision **D14**, requirements **DP05 / DP06**, building on F15 / F16 / F20 and DP04.

The owner selected these two additions after the profile/history navigation fix. Requested comparison detail is added, changed and deleted paths with before/after sizes and modification times. The calendar belongs on Home across vaults and inside each vault. Implement comparison first, then calendar; concrete backup/recovery problems remain higher priority under D13.

## Snapshot comparison (DP05)

### User flow

1. Open a source's backup history and choose **Compare backups**. Select an older and newer snapshot of that same source in the same vault/profile; default to the selected snapshot and its preceding completed snapshot when available.
2. Show both backup dates, names and outcome/coverage information, then Added / Changed / Deleted counts and a path-filterable results table.
3. Each row shows the relative path, entry type, change category, and before/after size and modification time. Missing values display as unavailable. File/symlink/directory replacements at the same path retain both types in the details.
4. Provide links to browse the relevant snapshot and a clear return to history that preserves the vault/profile context. Loading, no differences, insufficient snapshots, unavailable storage, cancellation and partial results have distinct states.

Use the existing square-corner graphite/blue components, semantic status labels and full accessible timestamps. File-level metadata is the requested first slice; text-content diffing and rename detection can be separate future work. A rename initially appears as an addition plus deletion.

### Data and implementation

- The pinned core exposes snapshot IDs, root object IDs and entry types through `/api/v1/snapshots`; directory objects expose names, object IDs, entry types, sizes, mtimes and mode/UID/GID metadata. No snapshot-diff endpoint was found in the registered UI API.
- Extract reusable, runtime-validated read helpers from the route-bound backup/directory hooks. Cache by vault, source and immutable snapshot/object IDs. Use existing authenticated main-proxied reads; carry cancellation and bounded timeouts through the request path.
- Compare exact snapshot-relative path segments. Preserve stored case and Unicode; never resolve a snapshot path against the user's filesystem or follow symlinks. Compare entry metadata before skipping identical directory-object subtrees. Detect same-size/same-mtime content changes using object IDs, and identify metadata-only differences where the data permits.
- Traverse changed directory pairs with bounded concurrency and incremental results. Added/deleted directories need enough traversal to show their contained paths. Keep file-byte totals separate from directory summaries to avoid double-counting; sizes represent logical data, not reclaimed storage.
- Failed reads or incomplete snapshot coverage must remain unknown/partial, never turn into an empty directory or a definitive deletion. Cancel when changing the selected pair or leaving the comparison. Virtualize or page large result sets and report any deliberate truncation.
- Resolve root-file metadata before declaring the feature complete: the current snapshot-list DTO omits root size/mtime, and `useBackupList` substitutes a zero summary when absent. `useDirectory` also drops raw file size while mapping entries. Read historical snapshot metadata through a supported narrow contract, or explicitly show unavailable values; current filesystem metadata cannot substitute for historical values. Any core API addition requires a deliberate pin update and focused compatibility evidence.

### Acceptance

- Disposable two-version fixtures cover unchanged files/subtrees, additions, deletions, edits with unchanged size/mtime, metadata-only changes, nested paths, symlinks, type replacements and single-file sources. Expected paths and before/after values match the manifests.
- Verify identical snapshots, reversed selection, two vaults/profiles with similar paths, partial snapshots, missing objects, offline/retry, cancellation and large-tree responsiveness. No repository mutation is required for comparison.
- Keyboard selection/filtering/browsing/return works in Light and Dark modes at 200% zoom. Counts and details distinguish incomplete results. Focused comparator/query tests and a pinned-engine fixture provide the evidence.

## Backup activity calendar (DP06)

### User flow

1. Home shows a month calendar aggregating available vault activity, with vault filtering. Each vault has the same calendar scoped to that vault, with device/user/source filters.
2. Days show accessible counts and text/icon outcomes. Selecting a day opens a chronological list with vault, source/profile, start/end time and result, plus links to snapshot history or available issue details.
3. Group terminal events by local completion day; show the timezone and both timestamps for work spanning midnight. Running/queued work is shown separately from completed activity. Month navigation and **Today** are keyboard accessible.
4. Distinguish completed, completed with issues, failed and incomplete/canceled records where the engine supplies evidence. Missing or offline vault history is visibly unavailable. An empty day means no recorded activity in the available history, rather than proof of a missed schedule.

### Data constraints found in the current pin

| Finding | Required treatment |
| --- | --- |
| `useBackupList({ filters: "none" })` omits `all=1`; the core deduplicates snapshots by root object ID by default. | Calendar reads must request `all=1` and count retained snapshot IDs, including repeated unchanged backups. Keep its query/cache contract distinct from existing statistics. |
| Snapshot-list items omit source identity. | For the initial implementation, fetch sources then bounded, source-scoped snapshot lists and attach the known host/user/path identity. Home needs explicit vault IDs rather than hooks that depend on the current route. Deduplicate within each vault by snapshot ID. |
| `lastBackupOutcome` stores only the latest qualifying SUCCESS / PARTIAL / FAILED result per source, across restarts. A subsequent result overwrites it; canceled/limited/skipped success does not replace it. | It supports known latest issue details, not a complete attempt history. Do not infer historical failures or cancellation from current state, or count a latest outcome and its snapshot twice. Outcome IDs and snapshot IDs differ. |
| Snapshot retention/deletion removes historical records; some attempts never produce a snapshot. | Label the first slice as available retained history, with latest known issues presented separately when an exact match cannot be established. Surface coverage rather than claiming a complete audit trail. |
| Root-file snapshots can have no directory summary. | Preserve absence/unknown; the current zero-filled summary is insufficient evidence for outcome classification or byte totals. |

### Delivery slices

1. **Calendar data contract:** runtime-validated records with vault/source identity, snapshot/outcome identity, start/end timestamps, known outcome and coverage. Share date grouping and outcome rules between Home and vaults. Cache immutable history and refresh after relevant events rather than multiplying one-second polling across all sources/vaults.
2. **Retained-history calendar:** deliver both requested placements, filters, keyboard day/month navigation and day details. Include available partial/incomplete snapshots and known latest failures with explicit coverage. Count a snapshot once even when it spans days. Treat unavailable vaults independently so one failure does not erase other histories.
3. **Durable attempt history:** a follow-up data slice is needed for a complete historical failure/cancellation calendar. Design engine-owned terminal-event history, retention limits, restart/reconnect deduplication and versioned local persistence before implementation. Record the on-disk decision in PLAN.md and follow its ownership/compatibility rules. Capture events while the renderer is closed; distinguish local attempt history from activity written by other devices. Never reconstruct unobserved history from guesses.

### Acceptance

- Calendar counts match source-scoped `all=1` results across two vaults and multiple profiles, including repeated identical backups, retained partial/incomplete records, single-file sources and known failures that produced no snapshot.
- Tests cover local midnight, timezone/DST boundaries, month/year/leap-day transitions, mixed-outcome days, retention/deletion, restart, overlapping fetches and unavailable vaults. Outcomes without a reliable snapshot association remain separate, labeled evidence.
- Keyboard and 200% zoom checks cover month navigation, day selection, filters, drill-down and return in both themes. History limitations and unavailable states remain visible.
- Durable attempt-history acceptance additionally requires repeated failed/successful/canceled runs across renderer closure and engine restart, with exactly-once terminal records and documented retention/coverage. This is future work, not evidence supplied by the current latest-outcome field.

## Inspected implementation references

- `apps/desktop/src/hooks/queries/core/use-backup-list.ts`, `use-directory.ts`, `use-source-list.ts`.
- `apps/desktop/src/lib/vault.ts` and `apps/electron/src/protocol.ts`: existing API transport and cancellation work needed for bounded traversal.
- `apps/core/internal/server/{server,api_snapshots,api_object_get,source_backup_outcome}.go` and `apps/core/internal/serverapi/serverapi.go`.
- Engine pin: `0f31eefe409cb4f0571baf65abd7d063784598cd`. These are source-inspection findings; the planned features have not been recovery/performance certified.
