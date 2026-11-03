# M2 — Truthful restore outcomes

Date: 2026-11-03. Requirements: **basic F17, DP04 / Q01, Q05; F18 regression**.

## Revision and scope

Application changes based on `705c394`; core remains the clean, published pin `dca6bebcba9c50f6f2658ae3662a52414f77bcf9`. No core, repository-format or encryption changes. The owner authorized committing and pushing this slice to application `main`; no tag or binary release is included.

Verified locally on Windows x64 with Node 24.14.0, pnpm 11.7.0, Go 1.25.5 and the pinned Electron. CI uses Node 24.15.0. Temporary repositories, profiles, outputs, ACLs and junctions live beneath `DISKPOND_TEST_TMP`; the developer profile and repositories are not used.

This is native coordinator recovery plus an isolated renderer **component** interaction fixture. It is not the complete renderer create/source/snapshot/history/restore journey, offline recovery, installed recovery, or M2 completion. TODO #3 retains that gate.

## Inherited contract review and changes

- `internal/uitask/uitask.go` and `uitask_manager.go` define RUNNING, CANCELING, CANCELED, SUCCESS and FAILED. Only the last three are terminal. A cancel request is not terminal confirmation.
- `internal/server/api_restore.go` exposes the restore task and counters. Failure counters can be the last progress report, not final totals. The result UI calls them **last reported** counts.
- `snapshot/restore/restore.go` returns output-close failures, including ZIP finalization failures. `ignoreErrors: false` and `ignorePermissionErrors: false` now apply throughout. Metadata failures are not silently ignored, and inherited post-restore chmod-to-0755 overrides are removed.
- Electron now uses engine restore tasks for selected files, links, directories and ZIPs. Selected entries are bound to the parent directory's actual object/type/name; standalone file-source timeline restores are bound to their snapshot manifest/root/type. This preserves entry metadata rather than downloading an unchecked HTTP response body. Keep-both allocation is sequential, including duplicate names in one selection.
- Runtime schemas validate requests, task responses and renderer results. All restore IPC handlers validate the main-window/frame/origin context. Narrow cancel/dismiss preload methods are added.
- Success requires a recognized SUCCESS result, required counters, no reported task error, and expected unpacked output types/file sizes (or a nonempty ZIP). Engine content validation remains authoritative; acceptance fixtures additionally compare SHA-256 hashes. Ignored/skipped items yield PARTIAL. Failure, cancellation and unavailable results never receive 100% or the success icon.
- Polling uses 15-second request timeouts, 250-ms polling, a 24-hour task monitoring limit and a 30-second cancellation-confirmation limit. Exceeding a monitoring limit requests cancellation and reports UNAVAILABLE, not CANCELED. Known completion wins a late cancellation request when all selected outputs were completed and checked.
- Native preflight rejects relative/missing destinations, traversal/Windows-invalid item names, case collisions, destination links/junctions (including ancestor and existing descendant links), and hard-linked ZIP output files. Nonempty directory overwrite requires native confirmation. Overlapping in-process restore destinations are reserved; an uncertain native writer keeps its reservation until its engine exits.
- Results remain in the main-process session until dismissed, including after engine loss; renderer polling is no longer disabled by vault status. The panel retains destination/object context, localized next steps, cancel/dismiss/open actions and a live status region. It uses indeterminate progress rather than invented percentages. Session history is bounded at 1,000 records; it is not a restart-persistent job journal.

## ZIP discovery

The pinned `snapshot/restore/zip_output.go` does not emit directory records or symlinks. The first real ZIP extraction check exposed a missing empty directory even though the engine reported SUCCESS. The application now inventories these omissions and reports PARTIAL with a localized explanation and skipped count. Both compressed and uncompressed ZIPs preserve the tested file contents. Unpacked restore retains empty directories.

This records an inherited F18 compatibility gap rather than silently reducing the requirement. Complete ZIP empty-directory/link preservation and the wider archive interruption matrix remain M4 work. No engine fork change was made to mask this finding.

## Reproduction and observed checks

Use the toolchain in DEVELOPMENT.md, then:

```powershell
$env:DISKPOND_TEST_TMP = 'C:\Users\HOXSEC\AppData\Local\Temp\opencode'
pnpm install --frozen-lockfile
pnpm lint:ci
pnpm types
pnpm test
pnpm unused
pnpm build:desktop
pnpm smoke:restores
```

Observed passes:

- Type checking and desktop build, including a clean pinned-core rebuild.
- Desktop-scoped Vitest: **606 tests** (240 Electron, 284 desktop, 20 schemas, 62 utilities). Restore regressions cover all engine terminal states, missing/unknown/malformed/mismatched tasks, absent success counters, ignored/skipped counts, permission/ENOSPC classification, cancellation acknowledgment, timeout cancellation, unsafe snapshot names, missing required output and native overwrite confirmation.
- Native real-engine fixture: empty file/directory, nested Unicode and 32-MiB file restore/hash checks; existing-file overwrite acknowledgment; two selected same-name files restored with keep-both names and identical hashes; standalone file-source snapshot restore; missing destination; Windows deny-write ACL for unpacked and ZIP output; junction rejection with an unchanged outside sentinel; compressed/uncompressed ZIP extraction/hashes and explicit omission accounting; cancellation before writing; cancellation during a real 2,000-file restore; engine termination while writing, then engine restart/reconnection and original-snapshot recovery hashes.
- Isolated Electron renderer fixture: actual result component, translations, shared controls/styles, all status presentations, keyboard cancel/dismiss, light/dark themes, long destination paths and 200% zoom without horizontal page overflow. Its query and bridge are test doubles; it does not certify production routing/preload integration end to end.
- Formatting/lint and dependency analysis pass. Analysis initially identified the removed restore queue's `p-limit` dependency and dynamic fixture entry points; the unused dependency/catalog entry was removed and fixture entries declared. The pnpm-generated lockfile changes only those direct/catalog references.

`smoke:restores` is added to the Windows workflow. Clean CI verification of this source handoff is pending. Existing passing published CI evidence applies to create/connect, not these changes.

## Remaining limits and blockers

- **Real full destination: blocked locally.** This session is not elevated (Windows administrator-role check returned false), and no disposable bounded-volume device was provided. The ENOSPC terminal-response regression passes, but it is not a real full-volume recovery test. Provision a disposable small VHD/test volume and verify unpacked and ZIP write/finalization failures before closing TODO #2's full failure matrix. Do not fill the host/developer volume.
- Existing link/junction preflight is verified. External concurrent filesystem replacement after preflight, arbitrary Windows reparse types, UNC destinations and later-OS filename/metadata behavior remain uncertified. The pinned engine does not provide a handle-relative no-follow writer; preflight is not a guarantee against a hostile local process racing the restore.
- ZIP empty-folder/link omissions are now truthful, not fixed at the format writer. Source symlink restoration remains dependent on platform privileges; this fixture proves destination junction rejection, not the full cross-platform symlink matrix.
- Main-process termination/restart loses the in-memory result list. Durable interrupted-job history and full desktop restart/offline recovery remain TODO #3–#4. The engine's own retained task list is also bounded.
- Installed-artifact and clean CI verification of this slice remain pending. No M2 gate is closed by the native/component evidence.
