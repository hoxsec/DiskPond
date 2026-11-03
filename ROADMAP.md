# DiskPond — Roadmap

- **Updated:** 2026-11-03
- **Current stage:** M1 complete; M2 branding/account-free workspace, credential/discovery and explicit create/connect slices are published with passing Windows CI. The published core guard is pinned; the desktop recovery gate remains open. [TODO.md](TODO.md) orders the next work.

This roadmap implements the owner-approved scope in [PLAN.md](PLAN.md). Requirement IDs refer to its parity inventory. [STYLE.md](STYLE.md) defines the interface and [AGENTS.md](AGENTS.md) defines contributor workflow.

## Delivery rules

- Solo, quality-first delivery. Sequence by dependencies and demonstrated recovery; assign dates only after measuring actual delivery capacity.
- Reuse the fork's existing implementation. A milestone usually means adapt, test, and certify features rather than rebuild them.
- An unchecked item is unfinished. Source presence, a mock, or a screenshot is not proof of functioning backup/restore.
- One primary milestone at a time. Resolve correctness failures before adding breadth.
- Scope exclusions are X01–X05 in PLAN.md. Provider and later-platform targets remain required unless the owner changes that decision.
- Record evidence in `docs/verification/` once implementation begins. “Blocked” is separate from “passed.”

## Milestone map

Effort is relative complexity, not a calendar estimate: **M** = contained integration; **L** = several subsystems; **XL** = a broad compatibility/certification matrix.

| Milestone | Outcome | Depends on | Effort | Status |
| --- | --- | --- | --- | --- |
| M0 | Agreed scope and planning documents | Owner answers, source review | M | Complete |
| M1 | Reproducible fork and Windows development build | M0 | M | Complete — local and clean Windows CI pass |
| M2 | Independent DiskPond local-backup vertical slice | M1 | L | In progress — branding/workspace, password, discovery, managed-provider and create/connect slices have scoped evidence; desktop recovery open |
| M3 | All BYO providers and existing-repository connectivity | M2 | L | Not started |
| M4 | Complete Windows backup/policy/recovery workflows | M3 | XL | Not started |
| M5 | Portable setup and release-ready Windows product | M4 | L | Not started |
| M6 | macOS and Linux parity certification | M5 | XL | Not started |
| M7 | Full desktop/BYO parity release | M6 | M | Not started |

Critical path: **import/build → local recovery → storage compatibility → complete workflows → Windows release → other platforms → full parity**.

## M0 — Product definition and reference audit

- [x] Confirm DiskPond, fork approach, Electron/React, and AGPL-3.0.
- [x] Confirm desktop/BYO scope, Windows first, and quality-first solo delivery.
- [x] Confirm account-free setup export, existing BYO repository support, and no telemetry.
- [x] Pin the application commit and its exact core submodule commit.
- [x] Inspect providers, policies, restore, persistence, packaging and cloud coupling.
- [x] Create PLAN.md, AGENTS.md, ROADMAP.md, and STYLE.md.

**Exit:** Requirements are documented and consequential initial decisions are answered. Runtime verification is still outstanding.

## M1 — Import, provenance and development baseline

**Outcome:** A contributor can build the pinned fork and launch its local desktop path on Windows from documented instructions.

- [x] Import application commit `e435469b3d09b8c217417d1325331865e483ce2f` without discarding existing repository history or planning files.
- [x] Preserve upstream attribution/license material and core commit `e8955e7280edd9526b9f104f1592f233cfe6789b`.
- [x] Reconcile upstream contributor instructions and record the import procedure and upstream remotes.
- [x] Verify Node/pnpm/Go versions from manifests; resolve outdated development instructions.
- [x] Establish Windows-compatible commands for renderer/main development and bundled-core build. Replace POSIX-only copy/remove wrappers where necessary.
- [x] Record baseline lint, type-check and relevant inherited test results; distinguish existing failures from regressions.
- [x] Produce an import graph for desktop dependencies on API/database/cloud libraries and a network endpoint inventory.
- [x] Choose DiskPond application/package/protocol/data-path/release identities using an owned namespace.
- [x] Investigate package support for Windows 10, the macOS minimum and Linux ARMv7; record initial gaps before scheduling certification.
- [x] Add CI for the desktop/core build and meaningful checks, with secrets unnecessary for ordinary desktop development.
- [x] Run the checked-in workflow on a clean Windows runner and link its result before closing M1: [run 41521154820](https://github.com/hoxsec/DiskPond/actions/runs/41521154820), revision `9c2969b12d1a105c6f96bff28bcfaa29ed779995`.

**Evidence:** Tested development guide, version manifest, baseline check results, built Windows engine, launched renderer/main, import and endpoint inventories.

Evidence: [Windows checks and clean CI](docs/verification/m1-windows-baseline.md), [provenance](UPSTREAM.md), [dependency/endpoints](docs/verification/m1-dependencies.md), [platform findings](docs/verification/m1-platforms.md). The owner-authorized integration branch is published. Clean Windows CI passed installation, lint, types, all 517 tests, dependency analysis, packaging and built/dev/installed smoke in 9m25s. All P/F/DP product certification gates remain open.

**Gate:** A clean Windows environment can reproduce the local development build. Nothing is published under BlinkDisk's identity or release feed.

## M2 — Account-free local backup alpha

**Requirements:** P01; F01–F02; basic F17/F22/F24; DP01, initial DP03–DP04.

Verified slice: [owner artwork, local workspace and hosted-service removal](docs/verification/m2-branding-workspace.md), including built/development/installed Windows smoke. The slice is committed and merged into `main`; integration CI and merged-main CI both passed. The real-recovery gate remains open.

Subsequent credential/discovery/provider changes are also merged into application/core `main`; both [integration CI](https://github.com/hoxsec/DiskPond/actions/runs/41548458540) and [merged-main CI](https://github.com/hoxsec/DiskPond/actions/runs/41550252893) passed, including Windows packaging and installed smoke. See the [publication record](docs/verification/m2-provider-storage-design.md#source-publication-and-windows-ci).

- [x] Promote the existing local-account path to the default account-free workspace.
- [x] Extract required contracts from cloud/API/database packages and remove hosted-service runtime requirements.
- [x] Remove login, subscription, billing and CloudBlink entry points; eliminate background authentication/configuration-sync jobs.
- [x] Remove analytics and crash-upload execution, build-time upload plugins and upstream service configuration.
- [x] Apply DiskPond product identity, isolated storage paths and original UI tokens.
- [x] Implement create-versus-connect entry points with provider validation and safe existing-repository detection.
  - [x] Nonmutating discovery in the owner-approved core fork: no `.shards` write on reads, no legacy migration from `/repo/exists`, no SFTP directory creation during discovery. [Published regressions and baseline-copy restore/hash evidence](docs/verification/m2-read-only-discovery.md) pass locally and in Windows CI.
  - [x] Separate renderer/native operations, native identity/destination guards, explicit-connect migration inventory and baseline recovery, and keyboard/error/three-vault restart fixture pass locally. [Create/connect evidence](docs/verification/m2-create-connect.md).
  - [x] Publish and pin the core initialization guard and inherited fixture correction (`dca6bebcba9c50f6f2658ae3662a52414f77bcf9`) in the owner-authorized matching application source handoff.
  - [x] Run clean Windows CI on the published create/connect slice: [run 41624170742](https://github.com/hoxsec/DiskPond/actions/runs/41624170742), application `5743e23a86dbe6358ac5ceeadbdd53886377720b`. Includes packaging, native recovery, renderer create/connect, development and installed smoke.
- [x] Preserve secure vault-password handling; make unavailable secure storage a session-only mode rather than a silent plaintext fallback.
  - [Windows password evidence](docs/verification/m2-password-storage.md): OS-protected round-trip, failure/session-only/re-entry, legacy-cache handling, three-vault engine interruption/reconnect and credential-file scans. Managed startup now reopens exact whitespace passwords automatically. Later-OS runtime checks and full F24/DP01 remain open.
  - [x] Implement owner-approved protected/session-only provider storage, metadata-only managed core connections, and migration of both inherited local provider copies. [Decision, published implementation and native recovery evidence](docs/verification/m2-provider-storage-design.md). Windows CI passes; live-provider and full desktop recovery certification remain open.
- [ ] Supervise the local engine, expose meaningful startup/failure status, and keep its API local/authenticated.
  - Managed disconnected startup, confirmed connection results and retryable unexpected exits are covered by the credential slice. Broader job interruption and desktop failure/recovery flows remain open.
- [x] Complete one real local-source → encrypted vault → snapshot history → restored-file journey. [Built-desktop local evidence](docs/verification/m2-desktop-recovery.md); broader offline/platform cases remain open.
- [x] Verify changed/deleted source contents can be restored from the correct version. Both versions pass renderer restore/hash checks before and after restart.
- [ ] Distinguish restore success, partial completion and failure in the vertical slice.
  - [Local native coordinator and renderer-component evidence](docs/verification/m2-restore-outcomes.md) covers explicit terminal states, kept results, cancellation/interruption, hashes, keep-both/overwrite and truthful ZIP omissions. Source handoff is authorized; clean CI, full-volume and full renderer recovery evidence remain open.
- [ ] Verify restart, window-close/tray behavior and persisted local settings.
- [ ] Record initial performance and network observations.

**Gate:** Q01 passes with a real engine and disposable local data; local creation, backup, restore and restart work with networking blocked. DiskPond coexists with BlinkDisk without sharing settings or credentials.

**Release meaning:** Internal Windows alpha. This proves the product's core workflow; provider and full-feature certification continues.

## M3 — Storage breadth and existing-vault compatibility

**Requirements:** P02–P11, F03, basic F20.

- [ ] Preserve all provider form fields, validation, aliases and mapping behavior.
- [ ] Certify external drives and NAS/UNC paths, including disconnection and reconnection.
- [ ] Certify S3-compatible storage with isolated test infrastructure and Amazon S3 with live isolated credentials.
- [ ] Certify Backblaze B2, Google Cloud Storage and Azure Blob against real test destinations.
- [ ] Certify SFTP password/key authentication, known-host verification, optional scanning, and missing-helper handling.
- [ ] Certify WebDAV authentication and connection failure cases.
  - M2's credential-isolated loopback fixture exercises distinct accounts, rejection, versioned restore hashes and restart/migration; live services and the renderer provider workflow remain uncertified.
- [ ] Certify Rclone remote/executable selection and unavailable/incorrect remote configuration.
- [ ] Create compatibility fixtures using the pinned BlinkDisk/core, then connect and restore through DiskPond.
- [ ] Verify repository identity/duplicate detection, legacy provider aliases, wrong-password handling and unsupported versions.
- [ ] Demonstrate a second-device connection and restore from another repository profile.
- [ ] Document provider prerequisites and any provider-specific limits discovered during testing.

**Evidence:** A P01–P11 provider matrix linked to Q01–Q03 results and existing-vault fixtures. Emulator-only results are labeled.

**Gate:** Every provider has a real backup/restore round trip and useful error reporting. Existing BYO fixtures remain recoverable. Missing credentials or hardware leave the associated target blocked.

## M4 — Complete Windows workflows

**Requirements:** F04–F21, including complete F17/F20; regression of M2–M3 requirements.

### Sources, jobs and policy editing

- [ ] Verify files and directories, drag/drop, pickers, labels/emoji and inclusion/exclusion size estimates.
- [ ] Verify manual jobs, backup-all, progress, queueing, cancellation, checkpoints and retry/resume semantics.
- [ ] Verify health/statistics and missing/permission/partial/failed states with copyable task details.
- [ ] Verify scoped policy inheritance, basic/advanced modes and draft activation/discard.
- [ ] Verify intervals, custom cron and catch-up; cover midnight, DST, sleep/wake, offline destinations and overlap.
- [ ] Verify all retention buckets, named pins and deferred maintenance behavior.
- [ ] Verify exclusion matching, rule files, cache/max-size rules and invalid-path repair.
- [ ] Verify every compression identifier/preset and extension/size filter.
- [ ] Audit every F13 mapped field against the actual core. Record supported engine behavior, UI exposure and preservation tests individually.
- [ ] Preserve upload/download bandwidth controls and measure their effect.
  - M2 managed-connection regressions preserve both limits across description updates, migration and restart. Throughput measurement remains open.

### History and recovery

- [ ] Verify snapshot browsing, names, pins, delete semantics and metadata columns/search.
- [ ] Verify single/multiple selection and complete-folder restore, with documented keep-both/overwrite behavior.
- [ ] Verify compressed/uncompressed ZIP restore and interrupted/failed output handling.
- [ ] Verify Windows mount/open/unmount, required helpers and busy-mount cleanup.
- [ ] Verify another device/user profile's history, source restrictions and restoration.
- [ ] Verify source removal versus vault disconnection, preserving original source files.
- [ ] Complete recovery/interruption/policy test sets Q01, Q02, Q04 and Q05 for the Windows feature set.

**Gate:** No confirmed silent data-loss, false-success, destructive-connect or unintentional-retention bug remains. Every F13 field has a recorded disposition; missing source evidence is investigated rather than silently dropped.

**Release meaning:** Windows feature-complete beta candidate, with portability/release polish still required.

## M5 — Portable setup and Windows release

**Requirements:** F22–F26, DP02, complete DP03–DP04; all Windows P/F requirements retained.

- [ ] Implement versioned authenticated setup export/import with documented KDF parameters and test vectors.
- [ ] Implement selected-vault export, optional provider-secret inclusion, duplicate handling and per-device path remapping.
- [ ] Require repository-password re-entry; exclude OS-keystore blobs and Rclone credentials from export.
- [ ] Verify wrong-password/tampered/unsupported packages leave existing local state untouched.
- [ ] Confirm imported setup does not activate schedules/scripts or perform repository maintenance implicitly.
- [ ] Finish local, rotated diagnostics and explicit redacted export; verify network behavior with updates enabled and disabled.
- [ ] Finish settings, startup controls, tray behavior, original branding and all English strings.
- [ ] Apply STYLE.md to loading, empty, unavailable, partial, failed and successful states; complete Q08.
- [ ] Implement DiskPond update discovery/download/install behavior and active-job handling.
- [ ] Build and sign NSIS release artifacts and the bundled executable as required by the release process.
- [ ] Verify Windows 10/11 x64 clean install, upgrade/migration, interrupted update, reinstall and uninstall data behavior.
  - M1 installed-startup probe passed on Windows 11; inherited uninstall leaves startup/URI registry entries. Track explicit cleanup/ownership behavior in this gate.
- [ ] Publish matching source/notices/checksums and install/provider/recovery/diagnostics documentation.
- [ ] Complete a fresh-install recovery drill using only the repository, provider access and repository password, plus optional setup export.

**Gate:** Q01–Q09 applicable Windows checks pass. The release candidate uses DiskPond identities and feeds, sends no telemetry, and has no unverified Windows requirement presented as supported.

**Release meaning:** First stable Windows release candidate. Product-wide cross-platform parity is still M7.

## M6 — macOS and Linux parity

**Requirements:** All applicable P/F/DP requirements on each additional supported target; especially F19 and F22–F26.

- [ ] Build universal macOS Intel/Apple Silicon core and app; verify both architectures on actual execution environments.
- [ ] Resolve the minimum supported macOS version against the reference Big Sur claim and current dependencies.
- [ ] Sign/notarize DMG and update ZIP; test keychain, privacy permissions, startup, native dialogs and update behavior.
- [ ] Verify macOS mounting prerequisites and permission/metadata restoration behavior.
- [ ] Build Linux AppImage/DEB/RPM for x86_64, arm64 and armv7l, resolving any runtime/toolchain gaps.
- [ ] Declare and test supported Linux distribution/runtime baselines; verify desktop integration and package upgrades.
- [ ] Verify secure-keyring and session-only modes, filesystem permissions and mount helpers on Linux.
- [ ] Run provider/restore workflows on each platform; exercise case sensitivity, Unicode, symlinks and cross-OS metadata limits.
- [ ] Round-trip setup packages between Windows, macOS and Linux with path remapping and credential re-entry.
- [ ] Validate shared-repository multi-device access, engine locking/maintenance ownership and different device profiles.
- [ ] Complete keyboard, theme, scaling and native-shell review on the added platforms.

**Gate:** The platform/format/architecture matrix contains evidence for every declared supported cell. A packaging configuration alone does not pass. Scope changes require the owner's recorded decision.

## M7 — Full desktop/BYO parity release

- [ ] Reconcile every P01–P11, F01–F26 and DP01–DP04 requirement with source evidence, implementation and platform results.
- [ ] Close gaps found in the final pinned-reference review; record intentional X01–X05 exclusions/replacements in user-facing documentation.
- [ ] Repeat the fresh-device recovery drill on every OS family using release artifacts.
- [ ] Verify previous DiskPond release upgrades and existing BlinkDisk BYO snapshot restoration.
- [ ] Review repository maintenance/retention behavior, long-running job stability and recorded performance regressions.
- [ ] Publish exact OS, architecture, runtime-helper and repository-version support details.
- [ ] Publish final artifacts, matching source, notices, checksums, release notes and recovery documentation.
- [ ] Establish ongoing upstream review, regression and release maintenance responsibilities.

**Gate:** All applicable requirements are verified; no unexplained matrix gaps remain. The owner accepts the documented support matrix and explicitly recorded scope.

**Release meaning:** DiskPond 1.0 desktop/BYO parity target. Version numbering for earlier Windows releases is selected during M5; it must not imply cross-platform completion prematurely.

## Execution backlog format

Each implementation issue should contain:

1. Requirement ID(s), milestone and source reference.
2. User-visible outcome and affected packages.
3. Dependencies, migration implications and required environment.
4. Acceptance scenario and evidence needed.
5. Status: not started / in progress / blocked / verified.

Use small vertical tasks. For example: **P09 — create an SFTP vault with a known-host entry, back up a fixture, reconnect, restore and compare hashes**. A task named only “add SFTP UI” is insufficient.

## Next implementation session

M1 is complete. M2 branding/local workspace, vault-password fallback, owned-core nonmutating discovery and approved managed-provider storage are published and merged, with evidence to their recorded scope. The credential/core workflow passes on both the integration branch and merged `main`. Explicit create/connect is published with the core guard pinned and passing clean Windows CI. Continue [TODO.md](TODO.md) with truthful renderer restore outcomes, then the offline desktop recovery journey. Interruption/lifecycle and initial performance/network evidence complete the remaining M2 work.

Release ownership, signing access, live provider test access and additional OS hardware remain project-owner inputs at their stated milestones. They do not block the next local M2 slice.
