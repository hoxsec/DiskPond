# DiskPond — Next work

Updated: 2026-11-03. **M2 complete — active milestone: M3 storage breadth.**

## Active M3 work

- [x] Compare inherited provider fields/aliases/mappings with the pinned baseline and core contracts; record the [provider matrix and prerequisites](docs/verification/m3-storage-breadth.md).
- [x] Verify the GCS JSON-payload and SFTP scanner regressions in the single final [Windows CI run 41645023929](https://github.com/hoxsec/DiskPond/actions/runs/41645023929), application `62ab2dd`; full provider/renderer certification remains open.
- [ ] Add isolated S3-compatible/SFTP fixtures and Rclone helper failure coverage; exercise renderer provider flows and second-profile recovery.
- [ ] Acquire isolated AWS/B2/GCS/Azure/WebDAV credentials and USB/NAS hardware; complete each provider's recovery/failure gates. Missing access is blocked, not passed.

## Completed M2 history

Final [Windows CI 41639380823](https://github.com/hoxsec/DiskPond/actions/runs/41639380823) passes at application `fb077fa`, core `0f31eef`. [Closure evidence](docs/verification/m2-desktop-recovery.md#final-windows-ci-and-m2-closure) supersedes the earlier pending/local-only notes below. Continue with M3; the M2 sequence is retained as history.

Credential storage, migration and nonmutating discovery are merged into application `main` at [`d45cda7`](https://github.com/hoxsec/DiskPond/commit/d45cda77b5a9c166a9d430fd3aabdd918730fc46). Both [integration](https://github.com/hoxsec/DiskPond/actions/runs/41548458540) and [merged-main](https://github.com/hoxsec/DiskPond/actions/runs/41550252893) Windows CI passed. Explicit create/connect and its CI fixture corrections are published through [`5743e23`](https://github.com/hoxsec/DiskPond/commit/5743e23a86dbe6358ac5ceeadbdd53886377720b), with core pinned at [`dca6beb`](https://github.com/hoxsec/diskpond-core/commit/dca6bebcba9c50f6f2658ae3662a52414f77bcf9) and [passing clean Windows CI](https://github.com/hoxsec/DiskPond/actions/runs/41624170742). See [credential/recovery evidence](docs/verification/m2-provider-storage-design.md) and [create/connect evidence](docs/verification/m2-create-connect.md) for the verified scope.

The completed M2 sequence follows. [ROADMAP.md](ROADMAP.md) owns milestone gates; [PLAN.md](PLAN.md) owns requirements and acceptance scenarios.

## 1. Explicit create and connect flows

**Requirements:** P01, F02; supporting F03 / Q02.

- [x] Give **Create a new vault** and **Connect an existing vault** distinct entry points and operations.
- [x] Preserve nonmutating discovery and useful errors for empty, missing, unrelated, corrupt and inaccessible destinations; reject duplicate identities and wrong credentials.
- [x] Guard creation against existing repository data, and prevent connection from falling back to creation. Native preflight and the core blob guard are covered; independent-client concurrent initialization remains an uncertified provider boundary.
- [x] Review explicit connection's inherited legacy-blob migration on disposable baseline copies. Record writes and compatibility effects before making it part of the user flow.
- [x] Exercise both flows with real repositories, restart/reconnect and restore/hash checks; cover localized loading/error states and keyboard focus.
- [x] Include the matching application/core changes in the owner-authorized source-publication handoff and advance the core pin to the published initialization guard.
- [x] Run clean Windows CI on the published create/connect slice, including packaging and installed smoke: [run 41624170742](https://github.com/hoxsec/DiskPond/actions/runs/41624170742).

**Published and verified locally/in CI:** [create/connect evidence](docs/verification/m2-create-connect.md), including built-renderer keyboard/error/restart checks and 32 native/CLI restore/hash comparisons. Final CI also closes the renderer recovery gate.

## 2. Truthful restore outcomes

**Requirements:** basic F17, DP04 / Q01, Q05; preserve F18 behavior.

- [x] Replace the inherited `RUNNING`/`COMPLETE` shortcut in `apps/electron/src/restore.ts` with confirmed terminal outcomes. Failed, partial, canceled and unavailable operations remain distinguishable from success; [scoped local evidence](docs/verification/m2-restore-outcomes.md).
- [x] Review `ignoreErrors: true`, task-result handling and bounded/cancelable polling; propagate actionable outcomes through validated preload/IPC/contracts, renderer queries and localized retained results.
- [x] Preserve explicit keep-both versus overwrite behavior. Native name/destination/link/junction preflight and overwrite acknowledgment are implemented and fixture-tested. External filesystem races and broader platform coverage remain explicit evidence limits.
- [x] Verify success, permission denial, missing/full destination, cancellation and interrupted-engine cases with disposable output and real-engine hashes. Final CI includes real full-volume failures and cleanup in all three modes.
  - Success/hash, keep-both/overwrite, permission denial, missing destination, junction rejection, cancellation/interruption and both ZIP modes pass locally and in final CI. Actual full-volume verification passes on the bounded VHD.
  - The pinned ZIP writer omits empty folders/symlinks. Results now report those omissions as partial; complete F18 archive parity remains M4 work.

**Published and verified in final Windows CI**, including offline renderer recovery and full-volume outcomes. See [restore outcome evidence and limitations](docs/verification/m2-restore-outcomes.md).

## 3. Complete the offline desktop recovery journey

**Requirements:** P01, F01–F02, basic F17/F24, DP01 / Q01, Q02, Q08.

- [x] From a fresh isolated desktop profile, create a local encrypted vault, add a source through the UI, make snapshot A, change/delete/add files, then make snapshot B.
- [x] Browse both versions and restore them through the renderer to separate destinations. Compare file SHA-256 hashes, directory entries and supported metadata, including deleted-file recovery from A. [Local desktop evidence](docs/verification/m2-desktop-recovery.md) covers entries/hashes/file modification times before and after restart; broader metadata remains below.
- [x] Include empty files/directories, nested Unicode paths, a large file, and link/permission fixtures with documented platform limits. Elevated CI passes relative symlink targets and read-only attributes; full ACL/platform metadata parity remains later work.
  - Empty entries, nested Unicode, a 32-MiB file, relative links and read-only metadata pass in the elevated desktop fixture.
- [x] Repeat after quitting/restarting with networking blocked; include multiple independent vaults and exact whitespace-bearing passwords. Both credential modes pass with scoped Electron/core non-loopback firewall blocking.
  - Two-vault restart and exact distinct whitespace passwords pass with remote Chromium/main-fetch requests blocked and scoped OS firewall rules active.
- [x] Confirm account-free operation and coexistence with BlinkDisk's profile/registration; exercise the critical journey in both themes, with keyboard navigation and 200% zoom. Isolated baseline-named profile sentinels and existing registration snapshots remain unchanged; this is namespace isolation, not simultaneous upstream-process certification.
- [x] Add a reproducible desktop recovery acceptance fixture and evidence under `docs/verification/`. `pnpm smoke:recovery` passes locally and in clean Windows CI.

## 4. Interruption, restart and desktop lifecycle

**Requirements:** basic F05/F22/F24, DP01 / Q05, Q07.

- [x] Exercise backup/restore cancellation, core termination, application restart and unavailable storage; show actionable retry/re-entry status and retain recoverable snapshots. Native restore interruption and desktop active-backup cancellation/termination preserve recovery; see [desktop evidence](docs/verification/m2-desktop-recovery.md).
- [x] Verify protected and session-only credentials across desktop restart, including the need to reconnect before unattended backups resume. Both desktop credential modes pass exact-password/provider re-entry and recovery.
- [x] Verify window close versus tray quit, persisted settings, startup failure reporting and owned-child cleanup without orphan sidecars. [Expanded local recovery](docs/verification/m2-desktop-recovery.md) passes; missing-storage startup now preserves a retryable failure instead of showing setup.

## 5. Initial network and performance evidence

**Requirements:** DP03 / Q06, Q09.

- [x] Observe renderer, Electron and core network activity during the complete local journey and restart. No remote Chromium/main-fetch requests were observed; OS rules enforce Electron/core offline operation. This is local-journey evidence, not packet-level or update-download certification.
- [x] Record hardware/toolchain/dataset, unchanged and incremental backup times, large-directory browsing, sustained restore, UI responsiveness, and memory/log/cache growth. Initial 32-MiB/512-entry measurements and per-process/app-data observations are in [desktop evidence](docs/verification/m2-desktop-recovery.md); long-duration profiling remains later work.
- [x] Publish reproducible commands, observed results and limitations, including passing OS-blocked CI recovery.

## Observed issue to reproduce during M2

- [x] Investigate `Core error: [NOT_FOUND] policy not found` using a disposable source/policy fixture (**F08/F24**). A missing host definition reproduces `NOT_FOUND` while effective inherited policy resolution succeeds; the query already handles it and the API wrapper logs it first. [Evidence](docs/verification/m2-desktop-recovery.md). The preserved developer profile was not changed; wider policy behavior remains M4.

## M2 completion gate

- [x] Close M2 only after Q01's real desktop two-version recovery, offline create/backup/restore/restart, meaningful terminal outcomes, lifecycle checks and initial network/performance evidence pass. [ROADMAP.md](ROADMAP.md) and evidence updated for passing run `41639380823`.

## After M2

- [ ] **M3:** certify USB/NAS and every BYO provider, existing BlinkDisk repositories, second-device restore and provider-specific failure cases. Acquire isolated live-provider credentials/hardware; loopback WebDAV success remains scoped evidence.
- [ ] **M4:** complete policy/scheduling/retention/pins, backup health, bandwidth measurement, browsing, ZIP/mount recovery and source-removal/disconnection verification; audit every F13 field.
- [ ] **M5:** implement encrypted setup portability, local redacted diagnostics export, update controls, accessibility polish, signing, Windows install/upgrade/uninstall and fresh-install recovery. Resolve the recorded startup/URI uninstall leftovers.
- [ ] **M6–M7:** certify macOS/Linux stores, builds and workflows on actual target environments, then reconcile the complete parity matrix and release evidence.

Use disposable repositories and isolated destinations throughout. Follow [AGENTS.md](AGENTS.md), [DEVELOPMENT.md](DEVELOPMENT.md) and [STYLE.md](STYLE.md); keep the application/core pin pair reproducible and record actual blockers rather than treating missing provider access or hardware as a pass.
