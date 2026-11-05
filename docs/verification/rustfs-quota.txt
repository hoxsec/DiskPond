# RustFS bucket quota — local verification

Date: 2026-11-03. Requirements: **F06 / P05 / DP04**. Released in **v0.1.2**. [Release verification](windows-v0.1.2.md).

## Behavior and provider contract

- S3 connections probe `GET /rustfs/admin/v3/quota-stats/{bucket}` on the saved endpoint, using its saved credentials, optional session token, region (default `us-east-1`) and explicit TLS settings. No additional setup is required for RustFS. The key needs `s3:GetBucketQuota` for the bucket, and the endpoint must expose the RustFS admin route.
- Successful readings show **Bucket quota remaining**. This is bucket-wide, including objects outside the vault prefix, not server disk free space or a per-vault allowance. RustFS usage accounting may lag writes.
- Exhausted and over-quota buckets show **0 B**. A null or cleared quota shows **No bucket quota**, never unlimited physical storage. Unknown usage, invalid/inconsistent data, permission errors, network failures and timeouts show **Unavailable**.
- Missing/unsupported routes (404/405/501) show **Not reported**. Known Amazon S3 endpoints are skipped because AWS has no bucket byte quota. Other custom endpoints receive the read-only capability probe; support for CloudWatch, MinIO, R2, Wasabi and B2 management APIs is not implemented.
- Uses the existing active-vault/main-frame IPC guard and 30-second overview refresh. Only status/remaining bytes cross into the renderer. Failed refreshes clear the number.
- Native HTTP(S) reads use `aws4` SigV4 signing, normal certificate verification unless explicitly disabled, no redirects, a five-second total deadline, a 16 KiB response limit, four concurrent probes maximum and shared in-flight reads for identical connections. Response errors/bodies and credentials are not logged or returned to the renderer. No repository data is listed or modified.

References: [RustFS quota documentation](https://docs.rustfs.com/en/administration/data/bucket/quota) and [quota handler source](https://github.com/rustfs/rustfs/blob/main/rustfs/src/admin/handlers/quota.rs), inspected on the date above. The handler permits nullable quota/usage fields; missing usage is not zero.

## Checks

Commands use pnpm 11.7.0 through the cached launcher because pnpm is absent from this shell's PATH.

- Focused Electron suites: `src/s3-storage-space.test.ts`, `src/storage-space.test.ts`, `src/vault/connection.test.ts`, `src/vault/connection-ipc.test.ts`: **63 tests passed** across the initial batch and final affected-suite reruns (23 S3, 17 connection, 23 filesystem/IPC). Loopback HTTP fixtures verify independent SigV4 signature reconstruction, session tokens, bucket/prefix scope, zero/over-quota/unconfigured/unknown states, invalid responses, HTTP failures/redirect rejection, response limits, deduplication, retry, deadlines/concurrency and AWS/unsafe URL rejection. Saved protected S3 connection restart and locked-credential handling are also exercised.
- Desktop/Electron/schema type checks, renderer build, copied frontend and production main/preload compilation: passed.
- `node scripts/smoke-history-ui.mjs`: passed actual overview/query quota success, zero, failed refresh and no-quota rendering, plus existing unsupported/filesystem states. Light and Dark/200% captures reviewed at `%LOCALAPPDATA%/Temp/opencode/diskpond-history-ui-0AtxC0/vault-quota-{light,dark-200}.png`.
- `pnpm unused`: passed.
- `pnpm lint:ci`: passed (742 files). `git diff --check`: passed.

## Remaining validation

No live RustFS server or credentials were supplied; real-server/version/permission compatibility remains unverified. Existing repository/core and credential formats are unchanged. This is not broad S3-provider certification.
