# SFTP destination available space — local verification

Date: 2026-11-03. Requirements: **F06 / P09**. Released in **v0.1.2**. [Release verification](windows-v0.1.2.md).

## Behavior

- SFTP vaults reuse the existing **Storage available** card and 30-second active-overview refresh. Electron opens a short-lived SSH/SFTP connection and sends only `statvfs@openssh.com` for the saved destination path. There is no shell, remote command, listing, repository initialization or write.
- Available bytes are `f_bavail × f_frsize`, with safe-integer validation before multiplication using BigInt. This is filesystem space available to non-root users, not a guaranteed user quota or per-vault allocation. Genuine zero remains **0 B**.
- Servers without the extension or returning `SSH_FX_OP_UNSUPPORTED` show **Not reported**. Authentication, host-key, permission, missing-path, disconnected, invalid-statistics and timeout failures show **Unavailable**.
- Saved password/private key and known-host data remain in main. Password takes precedence over key data, matching the pinned engine. Host verification runs before authentication. Exact names, custom ports, IPv6, aliases, wildcard/negated entries and OpenSSH hashed hostnames are supported; unknown, changed and revoked keys fail closed. CA host certificates are not supported by this probe. Legacy external-SSH mode is unsupported; configurations depending solely on local key/known-host files are unavailable rather than silently relaxing verification.
- Four concurrent probes maximum; identical reads share an in-flight request. A five-second total deadline destroys the connection, including stalled handshakes/authentication or statvfs requests. Only validated result status/bytes cross the existing active-vault/main-frame IPC boundary; no SSH errors, paths or credentials are returned to the renderer or logged.

The inherited engine already implements SFTP capacity, but its exposed implementation uses total free blocks rather than available blocks and is not exposed through the desktop HTTP API. This slice uses a native-owned `ssh2` reader and leaves the core pin unchanged.

## Verification

Environment: Windows x64, Node 24.14.0, pnpm 11.7.0, Electron 42.11.16. Commands used the cached pnpm launcher.

| Command/check | Result |
| --- | --- |
| `pnpm --filter @blinkdisk/electron exec vitest run src/sftp-storage-space.test.ts` | **17 passed**. Real loopback SSH transport and minimal SFTP wire fixture: password/key authentication, password precedence, host-key rejection before credentials, exact Unicode destination, differing block/fragment sizes and total/available blocks, unsupported extension/status, permissions/missing path, zero/unsafe values, deduplication/retry and timeout/concurrency. Host verifier checks hashes, IPv6/ports/aliases, negation, revocation and CA rejection. |
| `pnpm --filter @blinkdisk/electron exec vitest run src/vault/connection.test.ts src/vault/connection-ipc.test.ts src/storage-space.test.ts src/s3-storage-space.test.ts` | **64 passed**. Includes SFTP protected-connection restart, locked credentials and existing IPC/filesystem/RustFS behavior. |
| `pnpm --filter @blinkdisk/electron types`, `pnpm unused` | Passed. |
| `pnpm lint:ci`, `git diff --check` | Passed; Biome checked 744 files. |
| `node esbuild.config.mjs production` in `apps/electron` | Passed. Bundled JavaScript only; optional `cpu-features`/`sshcrypto` native addons are excluded and their install scripts explicitly disabled. Client/dependency license texts are copied into `build/licenses` for distribution. |
| `pnpm smoke:desktop` | Passed after rebuilding: real bundled Electron startup, onboarding/provider flow, settings/theme, retired IPC rejection and engine discovery on disposable settings/storage. |

Initial production smoke caught `ssh2`'s CommonJS `__dirname` requirement under ESM. The main bundle now provides the dirname shim alongside its existing `createRequire` shim; rebuilt smoke passed. The renderer and its previously verified available/unsupported/error UI are reused without changes for SFTP.

## Remaining validation

No live SFTP provider was exercised. External server/version/filesystem and actual user-quota behavior remain unverified. The owner subsequently authorized v0.1.2 publication; its installed-artifact backup/restore checks passed as recorded in the release verification.
