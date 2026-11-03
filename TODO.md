# DiskPond — Next work

Updated: 2026-11-03. **Active milestone: M2 — account-free local backup alpha.**

Credential storage, migration and nonmutating discovery are merged into application `main` at [`d45cda7`](https://github.com/hoxsec/DiskPond/commit/d45cda77b5a9c166a9d430fd3aabdd918730fc46). Both [integration](https://github.com/hoxsec/DiskPond/actions/runs/41548458540) and [merged-main](https://github.com/hoxsec/DiskPond/actions/runs/41550252893) Windows CI passed. Explicit create/connect and its CI fixture corrections are published through [`5743e23`](https://github.com/hoxsec/DiskPond/commit/5743e23a86dbe6358ac5ceeadbdd53886377720b), with core pinned at [`dca6beb`](https://github.com/hoxsec/diskpond-core/commit/dca6bebcba9c50f6f2658ae3662a52414f77bcf9) and [passing clean Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41624170742). See [credential/recovery evidence](docs/verification/m2-provider-storage-design.md) and [create/connect evidence](docs/verification/m2-create-connect.md) for the verified scope.

Work through the M2 items below in order. [ROADMAP.md](ROADMAP.md) owns milestone gates; [PLAN.md](PLAN.md) owns requirements and acceptance scenarios. Native fixture restores and installed-startup smoke do not complete the desktop recovery gate.

## 1. Explicit create and connect flows

**Requirements:** P01, F02; supporting F03 / Q02.

- [x] Give **Create a new vault** and **Connect an existing vault** distinct entry points and operations.
- [x] Preserve nonmutating discovery and useful errors for empty, missing, unrelated, corrupt and inaccessible destinations; reject duplicate identities and wrong credentials.
- [x] Guard creation against existing repository data, and prevent connection from falling back to creation. Native preflight and the core blob guard are covered; independent-client concurrent initialization remains an uncertified provider boundary.
- [x] Review explicit connection's inherited legacy-blob migration on disposable baseline copies. Record writes and compatibility effects before making it part of the user flow.
- [x] Exercise both flows with real repositories, restart/reconnect and restore/hash checks; cover localized loading/error states and keyboard focus.
- [x] Include the matching application/core changes in the owner-authorized source-publication handoff and advance the core pin to the published initialization guard.
- [x] Run clean Windows CI on the published create/connect slice, including packaging and installed smoke: [run 41624170742](https://github.com/hoxsec/DiskPond/actions/runs/41624170742).

**Published and verified locally/in CI:** [create/connect evidence](docs/verification/m2-create-connect.md), including built-renderer keyboard/error/restart checks and 32 native/CLI restore/hash comparisons. The full renderer recovery gate remains open. Continue implementation with **item 2** from the published application/core pair.

## 2. Truthful restore outcomes

**Requirements:** basic F17, DP04 / Q01, Q05; preserve F18 behavior.

- [x] Replace the inherited `RUNNING`/`COMPLETE` shortcut in `apps/electron/src/restore.ts` with confirmed terminal outcomes. Failed, partial, canceled and unavailable operations remain distinguishable from success; [scoped local evidence](docs/verification/m2-restore-outcomes.md).
- [x] Review `ignoreErrors: true`, task-result handling and bounded/cancelable polling; propagate actionable outcomes through validated preload/IPC/contracts, renderer queries and localized retained results.
- [x] Preserve explicit keep-both versus overwrite behavior. Native name/destination/link/junction preflight and overwrite acknowledgment are implemented and fixture-tested. External filesystem races and broader platform coverage remain explicit evidence limits.
- [ ] Verify success, permission denial, missing/full destination, cancellation and interrupted-engine cases with disposable output and real-engine hashes. Check the shared ZIP paths for regressions.
  - Success/hash, keep-both/overwrite, permission denial, missing destination, junction rejection, cancellation/interruption and both ZIP modes pass locally. Real full-volume verification is blocked pending a disposable bounded test volume; simulated ENOSPC mapping is not that evidence.
  - The pinned ZIP writer omits empty folders/symlinks. Results now report those omissions as partial; complete F18 archive parity remains M4 work.

**Source handoff authorized; local native/component evidence is scoped.** The full offline renderer recovery journey below remains open, as do clean CI and the full-volume case. See [restore outcome evidence and limitations](docs/verification/m2-restore-outcomes.md).

## 3. Complete the offline desktop recovery journey

**Requirements:** P01, F01–F02, basic F17/F24, DP01 / Q01, Q02, Q08.

- [ ] From a fresh isolated desktop profile, create a local encrypted vault, add a source through the UI, make snapshot A, change/delete/add files, then make snapshot B.
- [ ] Browse both versions and restore them through the renderer to separate destinations. Compare file SHA-256 hashes, directory entries and supported metadata, including deleted-file recovery from A.
- [ ] Include empty files/directories, nested Unicode paths, a large file, and link/permission fixtures with documented platform limits.
- [ ] Repeat after quitting/restarting with networking blocked; include multiple independent vaults and exact whitespace-bearing passwords.
- [ ] Confirm account-free operation and coexistence with BlinkDisk's profile/registration; exercise the critical journey in both themes, with keyboard navigation and 200% zoom.
- [ ] Add a reproducible desktop recovery acceptance fixture and evidence under `docs/verification/`. Extend CI once the fixture is reliable.

## 4. Interruption, restart and desktop lifecycle

**Requirements:** basic F05/F22/F24, DP01 / Q05, Q07.

- [ ] Exercise backup/restore cancellation, core termination, application restart and unavailable storage; show actionable retry/re-entry status and retain recoverable snapshots.
- [ ] Verify protected and session-only credentials across desktop restart, including the need to reconnect before unattended backups resume.
- [ ] Verify window close versus tray quit, persisted settings, startup failure reporting and owned-child cleanup without orphan sidecars.

## 5. Initial network and performance evidence

**Requirements:** DP03 / Q06, Q09.

- [ ] Observe renderer, Electron and core network activity during the complete local journey and restart. Record update behavior and verify no hosted-auth, sync, analytics or crash-upload traffic.
- [ ] Record hardware/toolchain/dataset, unchanged and incremental backup times, large-directory browsing, sustained restore, UI responsiveness, and memory/log/cache growth.
- [ ] Publish reproducible commands, observed results and limitations. The existing zero-remote-fetch smoke assertion is only scoped startup evidence.

## Observed issue to reproduce during M2

- [ ] Investigate `Core error: [NOT_FOUND] policy not found` using a disposable source/policy fixture (**F08/F24**). It was observed in the preserved developer profile and is not yet a confirmed regression. Distinguish expected missing/inherited policy from an actual failure before choosing a fix; preserve that profile and its repositories.

## M2 completion gate

- [ ] Close M2 only after Q01's real desktop two-version recovery, offline create/backup/restore/restart, meaningful terminal outcomes, lifecycle checks and initial network/performance evidence pass. Update [ROADMAP.md](ROADMAP.md) and requirement evidence together.

## After M2

- [ ] **M3:** certify USB/NAS and every BYO provider, existing BlinkDisk repositories, second-device restore and provider-specific failure cases. Acquire isolated live-provider credentials/hardware; loopback WebDAV success remains scoped evidence.
- [ ] **M4:** complete policy/scheduling/retention/pins, backup health, bandwidth measurement, browsing, ZIP/mount recovery and source-removal/disconnection verification; audit every F13 field.
- [ ] **M5:** implement encrypted setup portability, local redacted diagnostics export, update controls, accessibility polish, signing, Windows install/upgrade/uninstall and fresh-install recovery. Resolve the recorded startup/URI uninstall leftovers.
- [ ] **M6–M7:** certify macOS/Linux stores, builds and workflows on actual target environments, then reconcile the complete parity matrix and release evidence.

Use disposable repositories and isolated destinations throughout. Follow [AGENTS.md](AGENTS.md), [DEVELOPMENT.md](DEVELOPMENT.md) and [STYLE.md](STYLE.md); keep the application/core pin pair reproducible and record actual blockers rather than treating missing provider access or hardware as a pass.
