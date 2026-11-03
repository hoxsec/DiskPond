# Snapshot comparison and backup activity calendar

Latest owner placement correction (2026-11-03): Activity is available only through Home-level navigation. Remove the embedded per-vault calendar and the Activity link from compact vault navigation. This supersedes the earlier two-placement scope below (D14 / DP06).

Owner density follow-up (2026-11-03): each backup and latest-issue entry below the calendar is collapsed individually. Its compact summary shows folder name, completion time, vault, available logical size/file count and outcome. Expand for full names/path/profile, timestamps, errors and history navigation. [Verification](../verification/activity-compact-rows.md); released in v0.1.1.

Date: 2026-11-03. Status: **snapshot comparison and retained-history Activity released in v0.1.0; compact rows released in v0.1.1**. Decision **D14**, requirements **DP05 / DP06**, building on F15 / F16 / F20 and DP04. The owner explicitly authorized implementation and subsequent publication, superseding the earlier planning-only choice. [Delivery evidence](../verification/snapshot-comparison-and-activity.md) records commands, results and limitations. Owner actual-use feedback is next.

The owner selected these two additions after the profile/history navigation fix. Requested comparison detail is added, changed and deleted paths with before/after sizes and modification times. Subsequent owner feedback moves the cross-vault calendar from Home to a separate **Activity** tab, retaining the per-vault calendar, and removes explanatory UI prose from calendar/comparison screens. Concise status and error labels retain truthful outcomes. Concrete backup/recovery problems remain higher priority under D13.

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
- Root-file metadata required explicit handling: the snapshot-list DTO omits root size/mtime fields, and inherited `useBackupList` substitutes a zero summary when absent. The inherited `useDirectory` also dropped raw file size while mapping entries. The implementation preserves available historical values through validated reads and explicitly shows missing values; current filesystem metadata cannot substitute for historical values. Any future core API addition requires a deliberate pin update and focused compatibility evidence.

**Implementation finding:** the pin's `uploadFileWithCheckpointing` can attach a one-file summary (`files: 1`, `dirs: 0`, `symlinks: 0`) containing the saved file's exact size and mtime in `size` / `maxTime`. Comparison uses that supported metadata when present, and keeps absent summaries unknown. Directory-entry zero sizes omitted by the Go encoder are known zero; an absent root-file summary is not. Empty directory objects encode a nil entries slice as explicit `null`; only a validated empty summary permits that representation. Missing entries or nonempty-null objects fail the read.

### Acceptance

- Disposable two-version fixtures cover unchanged files/subtrees, additions, deletions, edits with unchanged size/mtime, metadata-only changes, nested paths, symlinks, type replacements and single-file sources. Expected paths and before/after values match the manifests.
- Verify identical snapshots, reversed selection, two vaults/profiles with similar paths, partial snapshots, missing objects, offline/retry, cancellation and large-tree responsiveness. No repository mutation is required for comparison.
- Keyboard selection/filtering/browsing/return works in Light and Dark modes at 200% zoom. Counts and details distinguish incomplete results. Focused comparator/query tests and a pinned-engine fixture provide the evidence.

## Backup activity calendar (DP06)

### User flow

1. Activity shows a month calendar aggregating available vault activity, with vault filtering. Home has no calendar. Each vault has the same calendar scoped to that vault, with device/user/source filters.
2. Days show accessible counts and text/icon outcomes. Selecting a day opens a chronological list with vault, source/profile, start/end time and result, plus links to snapshot history or available issue details.
3. Group terminal events by local completion day; show the timezone and both timestamps for work spanning midnight. Running/queued work is shown separately from completed activity. Month navigation and **Today** are keyboard accessible.
4. Distinguish completed, completed with issues, failed and incomplete/canceled records where the engine supplies evidence. Missing or offline vault history is visibly unavailable. An empty day means no recorded activity in the available history, rather than proof of a missed schedule.

### Data constraints found in the current pin

| Finding | Required treatment |
| --- | --- |
| `useBackupList({ filters: "none" })` omits `all=1`; the core deduplicates snapshots by root object ID by default. | Calendar reads must request `all=1` and count retained snapshot IDs, including repeated unchanged backups. Keep its query/cache contract distinct from existing statistics. |
| Snapshot-list items omit source identity. | Fetch sources then bounded, source-scoped snapshot lists and attach the known host/user/path identity. Activity needs explicit vault IDs rather than hooks that depend on the current route. Deduplicate within each vault by snapshot ID. |
| `lastBackupOutcome` stores only the latest qualifying SUCCESS / PARTIAL / FAILED result per source, across restarts. A subsequent result overwrites it; canceled/limited/skipped success does not replace it. | It supports known latest issue details, not a complete attempt history. Do not infer historical failures or cancellation from current state, or count a latest outcome and its snapshot twice. Outcome IDs and snapshot IDs differ. |
| Snapshot retention/deletion removes historical records; some attempts never produce a snapshot. | Label the first slice as available retained history, with latest known issues presented separately when an exact match cannot be established. Surface coverage rather than claiming a complete audit trail. |
| Root-file snapshots can have no directory summary. | Preserve absence/unknown; the current zero-filled summary is insufficient evidence for outcome classification or byte totals. |

### Delivery slices

1. **Calendar data contract:** runtime-validated records with vault/source identity, snapshot/outcome identity, start/end timestamps, known outcome and coverage. Share date grouping and outcome rules between Activity and vaults. Cache immutable history and refresh after relevant events rather than multiplying one-second polling across all sources/vaults.
2. **Retained-history calendar:** deliver both requested placements, filters, keyboard day/month navigation and day details. Include available partial/incomplete snapshots and known latest failures with explicit coverage. Count a snapshot once even when it spans days. Treat unavailable vaults independently so one failure does not erase other histories.
3. **Durable attempt history:** a follow-up data slice is needed for a complete historical failure/cancellation calendar. Design engine-owned terminal-event history, retention limits, restart/reconnect deduplication and versioned local persistence before implementation. Record the on-disk decision in PLAN.md and follow its ownership/compatibility rules. Capture events while the renderer is closed; distinguish local attempt history from activity written by other devices. Never reconstruct unobserved history from guesses.

Slices 1–2 are delivered and locally verified. Slice 3 remains deferred pending its separate owner decision.

### Acceptance

- Calendar counts match source-scoped `all=1` results across two vaults and multiple profiles, including repeated identical backups, retained partial/incomplete records, single-file sources and known failures that produced no snapshot.
- Tests cover local midnight, timezone/DST boundaries, month/year/leap-day transitions, mixed-outcome days, retention/deletion, restart, overlapping fetches and unavailable vaults. Outcomes without a reliable snapshot association remain separate, labeled evidence.
- Keyboard and 200% zoom checks cover month navigation, day selection, filters, drill-down and return in both themes. History limitations and unavailable states remain visible.
- Durable attempt-history acceptance additionally requires repeated failed/successful/canceled runs across renderer closure and engine restart, with exactly-once terminal records and documented retention/coverage. This is future work, not evidence supplied by the current latest-outcome field.

## Inspected implementation references

- `apps/desktop/src/hooks/queries/core/use-backup-list.ts`, `use-directory.ts`, `use-source-list.ts`.
- `apps/desktop/src/lib/{history,snapshot-comparison,backup-activity}.ts`, the history query hooks and `libs/schemas/src/history.ts`: delivered read contracts, comparison and retained-activity aggregation.
- `apps/desktop/src/lib/vault.ts`, `apps/electron/src/protocol.ts` and `apps/electron/src/vault/fetch.ts`: authenticated API transport with propagated cancellation for bounded traversal.
- `apps/core/internal/server/{server,api_snapshots,api_object_get,source_backup_outcome}.go` and `apps/core/internal/serverapi/serverapi.go`.
- Engine pin: `0f31eefe409cb4f0571baf65abd7d063784598cd`. Implementation preserves the pin and repository/persistence contracts. Broad recovery/performance certification remains deferred.
