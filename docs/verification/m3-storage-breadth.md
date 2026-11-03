# M3 — Storage breadth kickoff

Date: 2026-11-03. Requirements: P02–P11, F03, basic F20; Q01–Q03.

M3 is **in progress**, not certified. This first slice audits inherited provider
configuration and fixes the GCS credential payload and SFTP host-key scan paths.
The core remains pinned at `0f31eefe409cb4f0571baf65abd7d063784598cd`.

## Source audit and changes

Compared provider forms/hooks, schemas, registry and SSH helper against application
baseline `e435469b3d09b8c217417d1325331865e483ce2f`. Provider fields, defaults,
validation and aliases were retained; the registry's database type dependency
was replaced with the equivalent local union. Compared mapped keys with the
pinned core's `repo/blob/*/*_options.go` contracts.

- **P07:** GCS's form holds service-account JSON text, but the core expects raw
  JSON credentials. The inherited mapper sent a JSON string instead of an object.
  New/re-entered connections now send the parsed object; malformed/non-object
  JSON is rejected without exposing parser excerpts containing secrets. Stored
  form fields and repository formats are unchanged. Existing invalid saved
  connections may need provider re-entry. Live GCS authentication remains blocked.
- **P09:** OpenSSH emits normal server banners on stderr. The inherited scanner
  treated any stderr as failure, even with successful key output. It now uses
  exit status and nonempty key output, ignores comments, distinguishes a missing
  executable, and bounds helper runtime/output. Host/port are validated before
  process execution, and IPC requires the main window. Manual known-host entry
  remains available. Late scan results cannot overwrite changed host/port/key
  fields; failed scan clicks no longer create unhandled promise rejections.
- Regression cases cover stderr banners, absent helper, timeout/partial output,
  empty output, invalid hosts/ports, IPv4/IPv6, and GCS payload/error handling.

## Provider evidence and prerequisites

All destinations must be disposable and isolated from real backups. Retain the
repository encryption password separately from provider credentials.

| ID | Provider / configuration retained | Evidence and remaining gate |
| --- | --- | --- |
| P01 | Local path / native picker | [M2 Windows recovery](m2-desktop-recovery.md) passes; regression in final workflow. |
| P02 | External drive path | Blocked on USB/removable hardware; disconnect during backup, reconnect, restart and restore both versions. A local folder is not a USB certificate. |
| P03 | Mounted network path / Windows UNC | Blocked on an isolated NAS/share and credentials; exercise share outage and recovery. `FILESYSTEM` and `NETWORK_ATTACHED_STORAGE` aliases remain mapped to internal/network drive. |
| P04 | S3 endpoint, region, bucket/prefix, access key/secret, session token | Blocked on isolated AWS bucket/access; test valid/expired credentials and restart recovery. |
| P05 | S3-compatible endpoint, region, bucket/prefix, credentials/token, explicit HTTP/TLS verification switches | Isolated service round trip still pending. Insecure switches default off. Emulator evidence must be labeled separately from live storage. |
| P06 | B2 bucket, key ID/key, prefix | Blocked on an isolated B2 bucket/application key. Core decoding accepts inherited `keyId` case-insensitively as `keyID`. |
| P07 | GCS bucket/prefix, service-account JSON | Payload fix above; live round trip blocked on isolated bucket/service-account access. |
| P08 | Azure container, account, key/SAS, storage domain, prefix | Blocked on isolated account/container access; test both key and SAS paths. |
| P09 | SFTP host/port/user/path, password/private key, known-host data | Scanner fix above; password/key round trips and host-key mismatch still pending. `ssh-keyscan` on PATH is optional; otherwise paste known-host data. Scanned keys must be checked against the server administrator's trusted key before connection. |
| P10 | WebDAV URL, optional user/password | [M2 loopback recovery](m2-provider-storage-design.md) provides scoped account/restart/migration/hash evidence. Live TLS service and renderer round trip remain pending. |
| P11 | Rclone `remote:path`, optional executable | Install/configure Rclone independently; executable must be on PATH or explicitly selected. Missing executable, incorrect remote and representative remote round trips remain pending. Rclone owns its credentials. |

For each outstanding provider, run create/connect, two snapshots, browse and
restore/hash comparison, restart/reconnect, wrong credentials and interrupted
storage access. Preserve TLS and host-key checks. Do not use discovery to create
storage or upgrade repositories.

## Compatibility and next slice

F03 has [M2 baseline-copy discovery/connect recovery evidence](m2-create-connect.md),
but the cross-provider compatibility matrix remains open. Basic F20 still needs
a second-profile/device connection that browses and restores the original
profile's snapshots without taking over its sources or schedules. Unsupported
repository versions and provider-specific duplicate identities remain M3 gates.

Next: isolated S3-compatible and SFTP service fixtures, renderer provider journeys,
Rclone helper failures and second-profile recovery; then owner-supplied live
provider access and USB/NAS hardware. Do not mark these passed from source review.

## Verification

Local verification passed:

- `corepack pnpm --filter @blinkdisk/electron test src/ssh.test.ts src/vault/mapping.test.ts`: 2 files, 35 tests passed in one focused invocation.
- `corepack pnpm --filter @blinkdisk/electron --filter @blinkdisk/desktop -r types`: both packages passed.
- Scoped Biome check/format: six changed TypeScript/TSX files passed.

One final existing Windows GitHub Actions workflow is requested
on `integrate/m3-storage`. The workflow includes types, tests, pinned-core checks,
loopback provider recovery, offline desktop recovery, packaging and installed
smoke. Its result must be recorded before claiming verification; it cannot certify
the blocked live providers/hardware above.
