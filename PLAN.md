# DiskPond — Product and Engineering Plan

- **Updated:** 2026-11-03
- **Status:** **v0.1.0**, the first stable public Windows release, is published as GitHub Latest from `4d48be4`, including the update banner, comparison-label fix and public README refresh. [Release CI and downloaded checksums passed](docs/verification/windows-v0.1.0.md). Broad certification remains deferred.
- **Authorized follow-up:** the owner requested committing/pushing the current batch and publishing **v0.1.1**, including available storage, compact Activity rows and the Windows pnpm launcher fix. [Release preparation](docs/verification/windows-v0.1.1.md).
- **Delivery:** One developer assisted by coding tools; quality-first, milestone-driven.

DiskPond is an account-free, open-source desktop backup application derived from BlinkDisk. It preserves inherited desktop and bring-your-own-storage functionality, uses its Kopia-based engine, and provides an original, calm interface. Windows x64 is the current release platform; macOS/Linux and full parity are deferred.

### Active scope override — 2026-11-03

Latest D14 / DP06 placement correction: the calendar is only in the separate Activity tab reached through Home-level navigation. Vault pages no longer embed it or expose Activity in their navigation. This supersedes earlier per-vault calendar placement references. The owner's subsequent density preference uses individually collapsed backup rows below the calendar, keeping folder, completion time, vault, size/file count and status visible; expand for full details.

The owner replaced the M0–M7 certification sequence with the small [Now / Next / Later roadmap](ROADMAP.md). This decision takes precedence over milestone gates, full-parity promises and exhaustive verification requirements retained below as reference. The P/F/DP IDs remain useful feature inventory, not a checklist that must be closed before releasing Windows. Deferred capabilities are not removed or certified by this decision.

Prioritize tag-triggered Windows release CI/CD and a compact release check, then fix problems reported during actual use. Reuse existing passing recovery evidence. Test changed backup/security behavior narrowly; keep extended provider/platform suites manual. Existing cryptography, repository compatibility, truthful outcomes, credential protection and license obligations remain binding. No binary publication is authorized by this planning change alone.

Release update: with owner authorization, **v0.1.0-alpha.1**, **unsigned**, is published from application `dd6e3c2`. [Release CI](https://github.com/hoxsec/DiskPond/actions/runs/41654918106) and downloaded checksums passed. Owner installation/feedback is next. See [release instructions](docs/windows-release.md) and [verification evidence](docs/verification/windows-release-cicd.md).

On 2026-11-03 the owner authorized committing and pushing the complete graphite/blue identity, return-navigation and feature-planning batch to `main`, followed by **v0.1.0-alpha.2**, unsigned. It is published from application `f872617`; [release CI 41668791860](https://github.com/hoxsec/DiskPond/actions/runs/41668791860) and all downloaded checksums passed. [The release record](docs/verification/windows-alpha-2.md) tracks this batch.

## 1. Confirmed decisions

These decisions were made with the project owner. Changes must be recorded here and reflected in the roadmap.

| ID | Decision |
| --- | --- |
| D01 | Product name: **DiskPond**. |
| D02 | Fork BlinkDisk; retain provenance and reuse its working implementation. |
| D03 | AGPL-3.0 application, preserving upstream license terms and notices. The separately licensed core retains its Apache-2.0 license and notices. |
| D04 | Electron + React + TypeScript; retain the Kopia-based Go sidecar. |
| D05 | Full desktop/BYO-storage scope; no DiskPond-operated cloud storage, subscriptions, billing, or account service. |
| D06 | Windows 10/11 x64 first; macOS and Linux follow. |
| D07 | Account-free operation, manual vault connection, and password-protected setup export/import for additional devices. |
| D08 | Support connecting to compatible existing BlinkDisk BYO vaults and restoring their snapshots. Automatic import of BlinkDisk's application settings is not part of this decision. |
| D09 | No telemetry, usage analytics, or automatic crash uploads. Local logs and explicitly exported, redacted diagnostics are supported. |
| D10 | Original clean technical design: graphite/white surfaces, blue accents, zero-radius controls and panels, light/dark/system themes (System default; selector in Settings). Retain the owner's DiskPond logo and wordmark. Owner-selected refinement on 2026-11-03. |
| D11 | Solo, quality-first development; milestones have acceptance gates rather than invented dates. |
| D12 | Electron owns OS-protected/session-only vault passwords and provider connections. Migrate active local plaintext core connection JSON and inherited password-encrypted provider envelopes; preserve profile/cache/bandwidth metadata and compatible repository data. Managed sidecars start disconnected and receive exact credentials through the authenticated loopback API. |
| D13 | Windows release first: replace M0–M7 delivery gates with Now / Next / Later; prioritize release CI/CD, use owner-confirmed behavior and existing CI as baseline, minimize repeated testing, and defer broad provider/platform/parity certification. |
| D14 | Snapshot comparison with added/changed/deleted paths and before/after sizes and modification times, plus a backup activity calendar only in the separate Home-level Activity tab. Following implementation authorization, the owner removed calendar placements on Home content and inside vaults, and requested no explanatory UI prose. Use concise status/coverage labels. Durable attempt persistence remains a separate owner-reviewed contract. See [the feature plan](docs/plans/snapshot-comparison-and-activity.md). |
| D15 | On 2026-11-03 the owner authorized fixing the comparison label, committing/pushing the current work and publishing the first stable public release, **v0.1.0**, for Windows x64. Present DiskPond as a released product, add real screenshots/features to the README and remove unnecessary repository clutter. Keep the existing unsigned distribution path and deferred certification scope. |

### Document responsibilities

Owner update preference (2026-11-03, F25): show an in-app banner when a newer release is available; its action opens DiskPond's GitHub releases page in the default browser. Replace inherited automatic download/install and modal behavior with this notification-only flow. Automatic checks remain user-disableable. Settings also offers **Check for updates**, with a button spinner and result from the release's `latest.yml` asset; manual checks work in development. [Local verification](docs/verification/update-banner.md).

- [PLAN.md](PLAN.md): scope, evidence, architecture, behavior, and verification requirements.
- [ROADMAP.md](ROADMAP.md): implementation order, dependencies, milestone checklists, and release gates.
- [AGENTS.md](AGENTS.md): operational instructions for contributors and coding agents.
- [STYLE.md](STYLE.md): visual language, interaction patterns, accessibility, and code conventions.

## 2. Reference baseline and evidence

The reference is frozen so that “parity” has a reproducible meaning:

- Application: [`blinkdisk/blinkdisk@e435469b3d09b8c217417d1325331865e483ce2f`](https://github.com/blinkdisk/blinkdisk/tree/e435469b3d09b8c217417d1325331865e483ce2f), committed 2026-10-29.
- Core submodule: [`blinkdisk/core@e8955e7280edd9526b9f104f1592f233cfe6789b`](https://github.com/blinkdisk/core/tree/e8955e7280edd9526b9f104f1592f233cfe6789b).
- Review date: 2026-11-02. S1–S7 below are **source inspection**. Subsequent M1 build/startup evidence is recorded in [docs/verification/m1-windows-baseline.md](docs/verification/m1-windows-baseline.md); it is not backup/restore certification.

| Ref | Inspected evidence at the pinned application commit |
| --- | --- |
| S1 | [README and platform/storage claims](https://github.com/blinkdisk/blinkdisk/blob/e435469b3d09b8c217417d1325331865e483ce2f/README.md). |
| S2 | [Provider registry](https://github.com/blinkdisk/blinkdisk/blob/e435469b3d09b8c217417d1325331865e483ce2f/libs/constants/src/providers.ts), `libs/schemas/src/providers.ts`, `apps/desktop/src/components/forms/providers/`, and `locales/en/vault.json`. |
| S3 | [Policy schema](https://github.com/blinkdisk/blinkdisk/blob/e435469b3d09b8c217417d1325331865e483ce2f/libs/schemas/src/policy.ts), `apps/desktop/src/lib/policy.ts`, `apps/desktop/src/components/policy/`, and `locales/en/policy.json`. |
| S4 | [Desktop components](https://github.com/blinkdisk/blinkdisk/tree/e435469b3d09b8c217417d1325331865e483ce2f/apps/desktop/src/components): sources, backups, directories, dialogs, vaults; corresponding hooks, routes, and English locale files. |
| S5 | [Electron implementation](https://github.com/blinkdisk/blinkdisk/tree/e435469b3d09b8c217417d1325331865e483ce2f/apps/electron/src): IPC/preload, vault server, restore, password/encryption, local persistence, startup, tray, and updater. |
| S6 | [Packaging](https://github.com/blinkdisk/blinkdisk/blob/e435469b3d09b8c217417d1325331865e483ce2f/apps/electron/electron.builder.ts), `package.json`, `pnpm-workspace.yaml`, package scripts, and workflows. |
| S7 | [Core README](https://github.com/blinkdisk/core/blob/e8955e7280edd9526b9f104f1592f233cfe6789b/README.md), `LICENSE`, `go.mod`, and `Makefile` at the pinned core commit. |

### Findings that affect implementation

1. **The application is a monorepo with cloud coupling.** Desktop packages reference API/database types, account synchronization, analytics, and cloud UI. An account-free build requires dependency extraction and runtime verification, not just hiding buttons.
2. **The local persistence is already file-backed.** Electron uses SignalDB collections persisted to JSON and electron-store preferences. PostgreSQL belongs to the hosted service; it is not a new desktop requirement.
3. **Use manifests over stale setup prose.** The root requires Node `>=24.14.0`, `.nvmrc` pins `24.15.0`, and the package manager is pnpm `11.7.0`; the core declares Go `1.25` / toolchain `1.25.5`. M1 passed locally on Node 24.14.0 and in clean Windows CI on Node 24.15.0. DEVELOPMENT.md records both and uses the repository pin for reproduction.
4. **Some policies are mapped but lack visible editors.** Script hooks, VSS, error handling, filesystem boundaries, logging, and upload concurrency appear in schemas/converters. Preserve and verify these fields; do not advertise an unverified UI.
5. **Background execution is a desktop process.** Tray mode and login startup exist. A system service running while logged out is a separate capability, not an established parity requirement.
6. **Recovery results need review.** The restore implementation requests ignored errors and treats leaving `RUNNING` as completion in several paths. DiskPond must distinguish completed, partial, failed, and canceled outcomes.
7. **Credential persistence required a managed-core boundary.** Upstream includes plaintext/basic-text fallbacks and provider credentials in connection JSON. The [M2 password slice](docs/verification/m2-password-storage.md) and owner-approved [provider-storage slice](docs/verification/m2-provider-storage-design.md) use OS protection or session memory, migrate both inherited local provider copies, and keep managed-core files metadata-only. Native Windows restart/migration/restore fixtures provide scoped evidence; full F24 and later-platform certification remain open.
8. **Packager targets are not support certificates.** The README advertises macOS Big Sur+ and Linux ARMv7, while runtime/toolchain compatibility must be checked against the pinned dependencies. Unresolved targets remain open parity gaps.
9. **Initial platform findings:** pinned Electron 42 requires macOS 12+, conflicting with upstream's Big Sur claim; Linux ARMv7 archives exist but remain untested. [M1 platform record](docs/verification/m1-platforms.md).
10. **Discovery is not read-only upstream.** M1's disposable engine probe created `.shards`, and the inherited `/repo/exists` endpoint can migrate legacy blob IDs. The published [owned-core discovery slice](docs/verification/m2-read-only-discovery.md) removes those writes and SFTP's implicit directory creation, with local/CI baseline-copy restore/hash evidence. The [create/connect slice](docs/verification/m2-create-connect.md) adds separate operations, a published/pinned core initialization guard and explicit-connect migration/recovery evidence, passing locally and in clean Windows CI. Full compatibility remains open.

## 3. Scope contract

### Required product behavior

A user can install DiskPond, choose their storage, protect files or folders, schedule versioned encrypted backups, inspect their backup history, and restore on this or another supported device. Core backup/restore works without registration or access to a DiskPond server. Internet access is needed only for destinations or explicitly enabled services that require it.

The completion target is **desktop/BYO parity against the pinned baseline, with the owner-approved exclusions and replacement below**. An early Windows alpha is not full parity. Newly discovered desktop/BYO behavior must be added to the inventory before declaring completion; an unknown is not an implicit exclusion.

| ID | Upstream capability | DiskPond treatment |
| --- | --- | --- |
| X01 | CloudBlink managed storage/proxy, quotas, trials, upgrade prompts | Excluded by D05. Existing CloudBlink repositories are outside BYO compatibility. |
| X02 | Hosted accounts, magic-code login, account switching/transfers, server configuration sync | Replaced by a local workspace, manual connections, and encrypted setup export/import. Automatic configuration sync is intentionally absent. Repository device/user profiles remain supported. |
| X03 | Subscriptions, payments, billing portal, affiliates, transactional account emails | Excluded by D05. Local backup status and diagnostics remain required. |
| X04 | Commercial marketing site, hosted auth/checkout frontend, comparison tools/blog | Excluded as application deliverables. DiskPond still needs installation, storage, recovery, and release documentation. |
| X05 | Analytics and automatic remote crash reporting | Removed by D09; replaced with local diagnostics and deliberate export. |

Mobile clients, full-disk imaging/bare-metal recovery, live folder synchronization, a fleet-management server, and a new backup format are not claimed by this plan. Reassess scope if source review demonstrates an additional reference capability.

### Feature inventory

The inventory below records the original verification targets, not the current release checklist. `M#` refers to the archived milestones in ROADMAP-HISTORY.md. Current results are in `docs/verification/`; D13 defers exhaustive certification. Keep requirement IDs stable in issues, pull requests and acceptance records.

#### Storage providers

All providers must pass create, connect, snapshot, browse, restore/hash comparison, reconnect after restart, and meaningful connection-error tests. Preserve all exposed settings, including optional fields and legacy aliases.

| ID | Provider and required configuration | Evidence | Gate |
| --- | --- | --- | --- |
| P01 | Internal/local filesystem; native destination picker and persistent path. | S2 | M2 |
| P02 | External/USB drive; disconnected/reconnected drive behavior. | S2 | M3 |
| P03 | Network drive/NAS via OS-mounted paths, including Windows UNC paths. Preserve legacy `FILESYSTEM` and `NETWORK_ATTACHED_STORAGE` mappings. | S2 | M3 |
| P04 | Amazon S3: endpoint, region, bucket, prefix, access credentials, optional session token. | S2 | M3 |
| P05 | S3-compatible storage: custom endpoint, region, bucket/prefix, credentials/session token; explicit HTTP and certificate-verification options. | S2 | M3 |
| P06 | Backblaze B2: bucket, application key ID/key, prefix. | S2 | M3 |
| P07 | Google Cloud Storage: bucket, prefix, service-account JSON. | S2 | M3 |
| P08 | Azure Blob: container, account, key or SAS token, storage domain, prefix. | S2 | M3 |
| P09 | SFTP: host, port, user, remote path, password/private key, known-host data; host-key scan when available and manual entry otherwise. | S2 | M3 |
| P10 | WebDAV: URL and optional username/password. | S2 | M3 |
| P11 | Rclone: configured `remote:path`, optional executable path, remote/executable validation. Rclone owns its remote credentials/configuration. | S2 | M3 |

“Any Rclone remote” means integration with valid remotes supported by the tested Rclone version. Test representative remote types; record the adapter/version boundary rather than claiming every third-party service was tested. NAS support means an accessible filesystem mount/share, not a built-in SMB/NFS server.

#### Backup, policy, restore, and desktop capabilities

| ID | Requirement | Evidence | Gate / acceptance |
| --- | --- | --- | --- |
| F01 | Encrypted versioned snapshots, incremental operation, deduplication, compression. | S1, S7 | M2: restore known data byte-for-byte; a changed second snapshot preserves the first. Retain the engine's algorithms/format. |
| F02 | Multiple vaults; provider search, validation, duplicate detection, naming, encryption password setup, connect/retry/status. | S2, S4, S5 | M2: create and reconnect multiple independent vaults with distinct secrets and state. |
| F03 | Existing BlinkDisk BYO repositories. | S5, S7; D08 | M3: copied baseline repositories open and restore; an explicit connect path never initializes over an existing repository. |
| F04 | Individual files and directories as sources; drag/drop, native pickers, names/emoji, size estimation with included/excluded counts. | S4 | M4: both source types survive restart and restore, including unusual paths. |
| F05 | Manual backup, backup-all, queue/progress, cancellation, checkpoint/resume behavior. | S4, S5 | M4: jobs remain distinguishable, cancel safely, and resume/retry according to actual engine checkpoint semantics. |
| F06 | Protected file/directory/byte statistics, destination available space and backup-health summaries. | S4; owner follow-up | Counts come from known snapshot semantics; unavailable/partial status is not reported as healthy. Filesystem available-space card implemented locally after v0.1.0; [verification](docs/verification/vault-storage-space.md). |
| F07 | Missing source, permission, failed and partial backup details; task counters, logs, cancellation, copyable details. | S4, S5 | M4: error fixtures produce actionable outcomes; logs preserve useful context without secrets. |
| F08 | Policy tree, basic/advanced modes, inherited/custom values, source policy drafts and activation/discard. | S3, S4 | M4: edits affect the intended vault/profile/path scope and preserve unrelated fields. |
| F09 | Manual-only/scheduled modes, preset intervals, custom cron schedules, missed-backup catch-up. | S3 | M4: timezone/DST, midnight, sleep/wake, offline storage, and overlapping-job behavior are documented and tested. |
| F10 | Latest/hourly/daily/weekly/monthly/annual retention and named pins that protect snapshots from retention. | S3, S4 | M4: retained set matches rules, including pins, after maintenance on disposable repositories. |
| F11 | Exclusions by name, extension, or relative path; folder-only rules, rule files, cache exclusions, maximum file size, invalid-rule repair. | S3, S4 | M4: preview and engine behavior agree; Windows paths and out-of-root rules are covered. |
| F12 | Compression off/default/presets and all exposed algorithms; extension allow/deny lists and size limits. | S3 | M4: settings round-trip and snapshots restore under each supported codec. |
| F13 | Existing mapped policy fields: script hooks/timeouts/modes; VSS; error handling; filesystem boundary and parent-rule options; identical-snapshot handling; time-of-day scheduling; metadata/splitter fields; logging and upload concurrency. | S3 | M4: audit actual engine support; preserve supported values during edits and import. Schema presence alone does not establish a UI feature. |
| F14 | Per-vault upload and download bandwidth limits. | S4 | M4: limits persist and affect transfer behavior within a documented measurement tolerance. |
| F15 | Snapshot history/timeline, naming, pins, deletion, and deferred storage cleanup. | S4, S7 | M4: retained snapshots still restore; removing a reference is distinguished from later reclamation. |
| F16 | Snapshot directory browser, breadcrumbs, name filtering, selection, sortable/displayable metadata columns, symlink display. | S4 | M4: browse nested and large directories; show size, modified time and available mode/UID/GID metadata. |
| F17 | Restore a file, selected items, or a whole directory; destination selection and conflict behavior. | S4, S5 | M2 basic / M4 complete: verified contents; single/multi-item keep-both and directory-overwrite paths have explicit outcomes. |
| F18 | ZIP restore with compressed or uncompressed output. | S4, S5 | M4: archive contents match the selected snapshot and terminal failures remain visible. |
| F19 | Mount/unmount snapshots and open mounted paths in Explorer/Finder/file manager. | S4, S5 | M4 Windows / M6 other OSes: working prerequisites, read-only behavior, busy-unmount recovery, and cleanup verified per OS. |
| F20 | Repository device/user profile listing/filtering, browsing and restoring another profile's backups. | S4 | M3 basic / M4 complete: second-device restore works; unavailable local actions on another profile are explained. |
| F21 | Source removal and vault disconnection semantics. | S4, S5 | M4: source data is never deleted by backup-management actions; removal of snapshot history is explicit; disconnecting BYO storage leaves repository data intact. |
| F22 | Tray/background mode, login startup, single-instance behavior, native dialogs, taskbar progress, relevant app links. | S5 | M2 basic / M5 complete / M6 ports: closing a window versus quitting is clear; automatic jobs run while the desktop process is running. |
| F23 | Light/dark/system themes, English UI, localization infrastructure and preferences. | S4 | M5: all workflows in both themes; English is the baseline's currently listed language. |
| F24 | Local settings/configuration persistence, migrations, password handling, and startup recovery. | S5 | M2 basic / M5 complete: settings survive upgrades, secrets use OS protection or session-only storage, and damaged state produces a recovery path. |
| F25 | Update discovery, notification banner, manual check, failure/retry and GitHub release link. | S5, S6; owner override | Implemented: only DiskPond releases, Settings opt-out and manual installation through GitHub; [verification](docs/verification/update-banner.md). |
| F26 | Installers and packaged backup engine for every declared target. | S1, S6 | M5 Windows / M6 other targets: install, launch, snapshot, restore, upgrade, and uninstall matrix passes. |

Compression parity includes `none`, `gzip` variants, `zstd` variants, `s2` variants (including parallel variants), `pgzip` variants, `deflate` variants, and `lz4`, as enumerated in the pinned `libs/constants/src/algorithms.ts`. Preserve stored algorithm identifiers; UI presets are only labels over engine settings.

#### Owner-requested adaptations

| ID | Requirement | Gate / acceptance |
| --- | --- | --- |
| DP01 | Account-free local workspace with no hosted-service dependency. | M2: clean launch, local backup/restore, restart, and configuration changes succeed with network blocked. |
| DP02 | Encrypted setup export/import. | M5: a second installation imports selected configurations using an export passphrase, remaps local paths, requests missing secrets, and reconnects to existing snapshots. |
| DP03 | No telemetry; local logs and user-triggered redacted diagnostics export. | M2 removal / M5 export: observed network traffic matches configured storage and update behavior; exported diagnostics contain no credentials or unapproved identifying paths. |
| DP04 | Original DiskPond design with accessible, understandable recovery flows. | M2 foundation / M5 complete: STYLE.md applied to all required states and critical workflows. |
| DP05 | Compare two backups of the same source: added, changed and deleted paths, with before/after size and modification time. | Implemented locally under D14 with passing [focused verification](docs/verification/snapshot-comparison-and-activity.md): deterministic comparisons, explicit metadata/read gaps, bounded/cancelable traversal and paged keyboard-scrollable results. Owner preview remains pending. |
| DP06 | Backup activity calendar only in Home-level Activity, with vault filtering. | Retained-history slice implemented under D14 with passing [focused verification](docs/verification/snapshot-comparison-and-activity.md): local completion days, drill-down and separately labeled latest issues. Owner-requested [compact expandable rows](docs/verification/activity-compact-rows.md) implemented locally after v0.1.0. Complete failure/cancellation history requires the deferred durable-attempt slice. |

## 4. Fork and architecture strategy

### Import and upstream maintenance

1. Import the pinned application on an integration branch, preserving this repository's history, `.gitattributes`, and planning documents. Preserve upstream history/provenance through an explicit merge/import record; do not reset the existing branch to upstream.
2. Reconcile upstream `AGENTS.md`/other contributor instructions with DiskPond's documented decisions. Retain useful applicable build conventions and document changes.
3. Preserve the exact core gitlink. The owner approved `hoxsec/diskpond-core`, forked from `blinkdisk/core`; discovery, managed-storage, initialization-guard and restore failure-cleanup changes are published on its `main` and pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`. The original upstream baseline remains recorded in [UPSTREAM.md](UPSTREAM.md). Publish matching core source and deliberately advance the gitlink before distributing modified binaries. Do not track a moving branch for release builds.
4. Record both upstream commits, imported licenses, dependency manifests, and baseline results. Keep app rebranding, service decoupling, and engine changes in reviewable changesets.
5. Review upstream bug/security fixes regularly and before releases. Advance the baseline deliberately with compatibility tests and an updated feature inventory. Do not automatically merge product or cloud changes.
6. Before publishing binaries, include corresponding application/core source and build instructions, retained notices, and a readable attribution to BlinkDisk and Kopia.

### Target repository layout

Retain upstream structure to reduce merge cost. M1 imported the application/core/libs/locales and added `scripts/` plus `docs/verification/`; cross-package recovery fixtures under `tests/` remain planned.

```text
apps/
  desktop/       React renderer, routing, forms, backup/restore screens
  electron/      Main/preload, native integration, secrets, local persistence
  core/          Pinned Kopia-derived Go submodule
libs/
  ui/            Shared accessible UI primitives
  components/    Shared product components
  forms/         Form controls and validation integration
  schemas/       Runtime-validated contracts and shared domain types
  constants/     Provider registry, algorithms, application identity
  styles/        Design tokens, typography, global styles
  hooks/         Shared presentation hooks
  utils/         Small cross-package utilities
  assets/        DiskPond assets and retained third-party notices
  biome/         Shared lint rules
  typescript/    Shared compiler configuration
locales/en/      Complete English strings
docs/           Development, provider, recovery, compatibility, release guides
tests/          Cross-package/provider/recovery fixtures and acceptance records
```

Cloud-only `apps/api`, `apps/cloud`, `apps/web`, `apps/marketing`, and associated service libraries remain as imported source. The [M1 dependency map](docs/verification/m1-dependencies.md) records the inherited coupling. The [M2 workspace slice](docs/verification/m2-branding-workspace.md) extracts the required contracts and removes desktop API/database/auth/sync/telemetry imports. Retained service packages are outside desktop runtime/build entry points; provenance remains in version history.

### Runtime boundaries

```text
React renderer
  -> narrow, validated preload/IPC interface
Electron main
  -> local state, OS-protected secrets, native dialogs, update service
  -> supervised, authenticated loopback connection
Pinned Go backup engine
  -> encryption / snapshots / scheduling / retention / maintenance
  -> selected local, network, cloud-provider, or Rclone storage
```

- Preserve React, Vite, TanStack Router/Query/Form/Table, Zod, Tailwind, and existing UI primitives initially. Avoid a simultaneous framework rewrite.
- Keep file-backed local persistence initially. Schema/version migrations must be atomic or recoverable; do not introduce PostgreSQL or a desktop backend server for configuration.
- Main owns filesystem access, credentials, process execution, host-key handling, and sidecar lifecycle. Renderer uses named contracts, not arbitrary filesystem or shell access.
- Preserve local-only engine binding, per-process authentication and certificate verification. Supervise startup, backoff, exit and cleanup; avoid uncontrolled polling/restart loops.
- Keep the engine authoritative for snapshot IDs, encryption, deduplication, policies, retention and repository maintenance. UI state is not a second backup engine.
- Namespace DiskPond's application ID, protocol, user-data directory, cache, release feed, startup entry, package names and binaries. Never adopt BlinkDisk's credential cache or overwrite its settings implicitly.
- Audit published `@blinkdisk/*` dependencies separately from workspace packages; renaming an external package import does not create a DiskPond replacement.

### Domain concepts

| Concept | Meaning and ownership |
| --- | --- |
| Workspace | Local application settings; no hosted login or subscription. |
| Vault | A connection to one engine repository, with provider settings, local secret references, and repository identity. |
| Device/user profile | The repository's source ownership identity; distinct from a cloud account. |
| Source | File or directory on a particular device/user profile, with policy overrides. |
| Policy | Engine-compatible inherited settings. Missing, explicit zero/false, and reset-to-inherited are distinct. |
| Snapshot | A point-in-time engine manifest; never modeled as a live synced folder. |
| Job | Backup, restore, maintenance, or mount activity with an explicit lifecycle and terminal outcome. |
| Setup package | Portable encrypted connection metadata; not a backup of file contents. |

### Removing hosted dependencies

Use the existing local-account path as the starting point. Audit cloud routes, subscriptions, auth listeners, sync timers, API clients, environment validation, shared type imports, release URLs, error reporters, analytics, email prompts, and build-time uploads. A desktop-only development command must start only the renderer, Electron, and local engine.

After extraction, run network-observation checks in fresh and upgraded profiles. Allowed network use is user-selected storage, configured DiskPond update checks/downloads, and explicit external-link actions. Disable automatic update traffic when the preference is off. A disabled analytics API key is not sufficient if collectors or remote dependencies still execute.

## 5. Recovery and portability contracts

### Existing repositories

- Compatibility is tested against the pinned BlinkDisk/core pair first. Maintain a version/provider/OS matrix; support for every historic BlinkDisk or arbitrary Kopia version is not assumed.
- Test on disposable copies. Discovery must not create a new repository, change its format, start pruning, or overwrite existing configuration accidentally.
- Distinguish **Create vault** from **Connect existing vault**. Verify identity, encryption password and provider configuration before enabling writes or scheduled maintenance.
- Do not silently upgrade repository formats. New engine versions require old-snapshot restore tests and a documented upgrade/recovery strategy.
- A second device can browse and restore other device profiles. It must not silently take ownership of their local source paths or start their schedules.
- Preserve existing policies and metadata, including supported fields that are not exposed in the basic editor. Unknown fields require an explicit preservation/compatibility decision rather than silent loss.

### Encrypted setup export/import

Planned format: a versioned authenticated-encryption envelope, implemented in Electron main using maintained cryptographic primitives. Use a password KDF such as Node's `scrypt` with AES-256-GCM, fresh random salt/nonce, authenticated format/KDF metadata, and bounded import parameters. Record reviewed parameters and test vectors before shipping; this does not change repository encryption.

The export contains selected vault names/identities, provider configuration, portable preferences, and local path hints. Provider secrets are excluded by default and may be included only through an explicit export option. Repository encryption passwords, OS-keychain blobs, and Rclone's separate credential store are never included. Explain exactly what the recipient must supply.

Import authenticates before parsing content, validates version/schema, previews additions/duplicates, remaps machine-specific paths, and requests credentials and repository passwords. Importing setup does not execute scripts, activate schedules, prune snapshots, or overwrite existing settings. Writes become available through the normal reviewed connection/setup flow. A corrupted or wrong-password package leaves local state untouched.

### Data and job invariants

1. A completed backup represents a usable snapshot. Partial and failed jobs remain visibly distinct from success.
2. A restore is successful only when its terminal result and required outputs are verified. Ignored/skipped files are counted and explained.
3. Repository removal, source removal, snapshot deletion, and deletion of source files are different actions. DiskPond's backup-management actions do not delete original source data.
4. Restore conflicts follow a documented mode. Preserve keep-both behavior for selected items and explicit overwrite confirmation for whole-directory restore into nonempty destinations.
5. Validate paths at the main/engine boundary. Cover traversal, absolute-path surprises, symlink/junction escapes, case collisions, Unicode and platform filename constraints.
6. Application shutdown, sleep, update, lost network, or detached storage must not turn a partially completed operation into a false success. Recovery follows engine transaction/checkpoint behavior.
7. Logs, errors, clipboard diagnostics, and exported reports exclude passwords, keys, tokens and plaintext configuration secrets. Sensitive local paths are redacted in exports by default.
8. Keep TLS and SSH host-key verification enabled by default; exposed upstream insecure options remain explicit per connection rather than becoming global defaults.

## 6. Platform and distribution plan

| Target | Required packaging | Delivery / unresolved validation |
| --- | --- | --- |
| Windows 10/11 x64 | NSIS installer with bundled Windows core | M1 development, M2 alpha, M5 stable Windows candidate. Test UNC paths, permissions, long paths, tray/startup, uninstall, signing, updates and mount prerequisites. |
| macOS Intel + Apple Silicon | Universal DMG and update ZIP with bundled universal core | M6. Validate deployment minimum, signing/notarization, privacy permissions, keychain, startup and mount prerequisites. Big Sur+ is the reference claim to investigate. |
| Linux x86_64, arm64, armv7l | AppImage, DEB, RPM with matching core | M6. Validate each format/architecture, supported distributions, keyring availability, desktop integration and mount prerequisites. |

Keep all declared targets on the roadmap. If a pinned runtime cannot build or run on a target, record the incompatibility and proposed solution; changing the support promise requires an owner decision. Never mark a matrix cell complete because another architecture worked.

Sign release artifacts where applicable, publish checksums and matching source, and test installation/upgrades using packaged binaries. Updates must resolve to DiskPond-controlled releases and must wait for or deliberately resolve active backup/restore operations. Linux package-managed installations use the documented package upgrade path where in-app updates are unsupported.

External runtime dependencies such as Rclone, `ssh-keyscan`, and mounting helpers require detection, supported-version guidance and actionable setup instructions. Identify the actual mounting mechanism on each OS before promising a particular driver. No bundled driver or working mount is assumed from a UI button.

## 7. Verification strategy

| ID | Evidence required |
| --- | --- |
| Q01 — recovery | Real engine: create snapshot A, modify/delete source data, create B, restore both to separate destinations, compare hashes and supported metadata. Include empty files/directories, Unicode, nested paths, large files and link/permission fixtures. |
| Q02 — compatibility | Baseline-produced disposable repositories, reconnect/restart, second-device restore, policy round-trip, compatible engine upgrade and unsupported-version behavior. Document metadata that cannot be represented on a destination filesystem. |
| Q03 — providers | Local/USB/NAS exercises; reproducible S3-compatible, SFTP and WebDAV test services; real isolated AWS/B2/GCS/Azure smoke tests. Emulator success does not certify a live provider. Missing credentials mean blocked, not passed. |
| Q04 — policies | Table-driven scope/inheritance and path-rule tests; clock-controlled schedules including zero-valued times and DST; retention/pins and maintenance on disposable repositories. Audit every F13 field. |
| Q05 — interruption | Cancel, process termination, restart, sleep/wake, disconnected drive/network, wrong credentials, permission denial, full destination, corrupted fixture and lost mount. Verify terminal status and retained recovery ability. |
| Q06 — privacy/portability | Network observations with/without updates enabled; secret/log redaction; locked/unavailable OS key store; setup-package tampering, wrong password, duplicates and path remapping. |
| Q07 — desktop release | Clean install, app/data namespace isolation, upgrade and migration, uninstall behavior, tray/startup, update failure/retry, native dialogs and packaged-core resolution. |
| Q08 — UX/accessibility | Keyboard-only create/connect/backup/restore; focus and screen-reader status; light/dark/system; 200% zoom; long names, empty/loading/error/partial/offline states; STYLE.md contrast checks. |
| Q09 — performance | Record hardware, versions and datasets at M2. Compare unchanged and incremental backups, a large directory and sustained restore. Keep UI responsive and memory/log/cache growth bounded; investigate material regressions against the recorded baseline. |

Use existing Vitest coverage and add focused regression tests for meaningful behavior. Add Electron end-to-end coverage for critical user journeys and real-engine integration fixtures; mocks cannot prove restore correctness. Full provider/OS matrices are milestone/release gates, not a requirement for every copy or styling edit.

Store evidence under `docs/verification/` with requirement IDs, commits, engine version, OS/architecture, provider, fixture, commands, observed outcome, and outstanding limitations. M1 establishes the current commands in DEVELOPMENT.md; later acceptance suites extend that contract.

## 8. Risks and decisions to resolve during implementation

| Issue | Resolution / gate | Owner |
| --- | --- | --- |
| Fork/cloud dependency graph is wider than the UI | Map imports and network activity; extract contracts before pruning services. M1–M2. | Maintainer |
| Toolchain prose/scripts differ; some scripts use POSIX shell commands | Pin a verified toolchain and provide Windows-friendly build wrappers. M1. | Maintainer |
| Existing repo writes or policy conversion change old behavior | Compatibility fixtures and field-preserving edits before enabling migration. M3–M4. | Maintainer |
| Restore outcomes or unsupported metadata misrepresent recovery | Explicit result mapping and hash/metadata verification. M2–M4. | Maintainer |
| Platform minimums, ARMv7 and mounts require actual certification | Publish per-target results; unresolved cells block full parity. M1 discovery / M6 closure. | Maintainer; owner for scope changes |
| Credential storage differs across OSes | OS-backed secure storage; session-only fallback with clear unattended-backup implications. M2 / M6. | Maintainer |
| Live provider accounts and test hardware are unavailable | Acquire isolated test access before certification; show blocked status. M3 / M6. | Project owner |
| Signing access and public releases remain unconfigured | M1 uses `hoxsec/DiskPond`, `io.github.hoxsec.diskpond`, `diskpondapp`, and separate DiskPond data/startup/artifact names. Signing and public release authorization remain M5–M6. | Project owner |
| Export portability adds a format to maintain | Versioned envelope, reviewed parameters, fixtures and upgrade policy. M5. | Maintainer |
| Ongoing upstream changes and solo capacity | Small changesets, one primary milestone at a time, triage upstream changes before each release. Ongoing. | Maintainer |

## 9. Completion definition

The product reaches the full desktop/BYO parity milestone only when every applicable P/F/DP requirement is demonstrated on its required platform(s), all platform/support gaps are resolved or explicitly re-scoped by the owner, and backup recovery succeeds from a fresh installation. Documentation must state the exact supported versions and the X01–X05 exclusions/replacements.

**The first stable Windows release is published and verified:** [v0.1.0 release record](docs/verification/windows-v0.1.0.md). M1/M2, the M3 kickoff and all three alpha releases retain their recorded evidence; further certification is deferred under D13. [TODO.md](TODO.md) lists the immediate work.
