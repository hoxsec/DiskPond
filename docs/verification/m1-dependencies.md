# M1 — Desktop dependency and network inventory

Date: 2026-11-02. Baselines: application `e435469b3d09b8c217417d1325331865e483ce2f`, core `e8955e7280edd9526b9f104f1592f233cfe6789b`.

Requirements informed: DP01, DP03, F02–F03, F22, F24–F26; exclusions X01–X05. This is a source audit plus a narrow startup smoke, not full privacy or repository-compatibility certification.

## Dependency graph

```text
apps/desktop
  -> libs/{components,forms,ui,hooks,styles,constants,schemas,utils,assets}
  -> apps/electron/preload types + @blinkdisk/signaldb-electron renderer bridge
  -> apps/api/router [AppRouter, type-only, lib/trpc.ts]
  -> PostHog / Sentry / LogSnag hook / better-auth UI [inherited]

apps/electron
  -> libs/{constants,schemas,utils}
  -> apps/api/router [AppRouter, type-only, src/trpc.ts]
  -> SignalDB core/fs + electron-store [local JSON persistence]
  -> @blinkdisk/signaldb-electron main/preload bridge [external package]
  -> better-auth + @better-auth/electron [runtime auth/client integration]
  -> db/sync.ts -> tRPC API [online accounts only]
  -> core executable -> authenticated TLS on 127.0.0.1:ephemeral-port

libs/schemas/{config,vault}.ts
  -> libs/db/schema.ts [runtime ConfigLevel and VaultStatus constants]
  -> drizzle-orm schema definitions [runtime import graph]
libs/constants/providers.ts
  -> libs/db/schema.ts [ConfigLevel type-only]
libs/utils package manifest
  -> libs/emails + Plunk/nodemailer/react-email [service-era helpers]
```

Source references are relative to the repository root. There is no direct desktop import of the cloud worker, but CloudBlink provider mapping still injects `CLOUD_URL`, token and version in `apps/electron/src/vault/mapping.ts`. The Electron manifest still declares API/db packages; renderer declares API types as a dev dependency. Package declarations are not proof that the entire hosted service executes in the desktop.

`libs/db/src/index.ts` constructs PostgreSQL connections only through its database factory. Desktop schemas import `schema.ts`, not that factory. No PostgreSQL instance was running or required for the passing local launch. Shared enum extraction is still necessary to remove the database dependency cleanly.

`apps/electron/src/db/index.ts` creates the `local` collections without registering remote synchronization. Other accounts register sync adapters in `src/db/sync.ts`; auth, account menus/listeners, refresh and cloud entry points still exist. These must be removed rather than merely relying on users to select local mode.

`@blinkdisk/signaldb-electron` is a published external package pinned through the catalog/lockfile, unlike the workspace `@blinkdisk/*` packages. Retaining the published name is intentional; a rename would require an actual fork and audit.

## Endpoint inventory

| Endpoint / transport | Source / trigger | M1 disposition and next gate |
| --- | --- | --- |
| `http://127.0.0.1:3002`, Vite HMR/devtools | Vite config and desktop runner | Development-only renderer and tooling. Bind renderer to loopback with a strict port. Tooling port exposure also needs review before remote development. |
| `diskpondapp://frontend` and `/locales/...` | Electron protocol handler, shared i18n | Local packaged/preview assets and English locale files. No CDN fonts required for initial UI; Inter is a bundled package. |
| `diskpondapp://vault` → TLS `127.0.0.1:0` | `src/protocol.ts`, `src/vault/{server,fetch}.ts` | Engine generates a certificate and per-process passwords; main uses its certificate and authenticated requests. Real discovery probe passed. Lifecycle/error/log review remains M2. |
| `diskpondapp://api` → `API_URL`, including `/trpc` and auth calls | Renderer/Electron tRPC clients, protocol proxy, `src/auth.ts`, sync adapters | Default `http://127.0.0.1:4000`. No API process required by exercised local onboarding. Remove clients/background auth/sync in M2. Main-process fetch is outside the renderer smoke interceptor. |
| `WEB_URL` auth/checkout/portal | Main auth client and renderer checkout hooks | Default `http://127.0.0.1:3001`; inherited account/billing UI awaiting M2 removal. |
| `CLOUD_URL` | CloudBlink provider mapping in main, corresponding core adapter | Default `http://127.0.0.1:4001`; no CloudBlink support claimed. Remove this provider/UI in M2 without disturbing BYO mappings. |
| `https://eu.i.posthog.com` and SDK-derived endpoints | Renderer root PostHog provider, auth and action hooks | Build forces an empty key; SDK/provider code remains. M2 must remove execution and validate more than startup. |
| Sentry DSN endpoints and build upload service | Main/preload/renderer initialization and capture helpers | Initialization disabled; DSN empty; desktop Vite/esbuild upload plugins removed. Runtime SDKs/capture calls and inherited non-desktop integrations remain to extract. |
| `https://api.logsnag.com/v1/log` | `use-logsnag.ts`, create/delete-vault hooks; service helper in utils | Desktop key forced empty and transmission returns early without a key. Remove hook/call sites and service helpers in M2. |
| `https://cdn.jsdelivr.net/npm/emojibase-data@...` | `frimousse` default dataset fetch in `libs/ui/src/emoji-picker.tsx` | Opening the emoji picker can fetch data. Bundle/pin data for account-free/offline UI. Startup smoke does not open this control. |
| `https://twemoji.maxcdn.com/v/latest/{svg,72x72}/...` | `twemoji-parser` default URLs used by source cards and emoji picker | Inherited image requests; replace with local assets/native rendering while retaining notices. No emoji-bearing source was present in the empty-workspace smoke. |
| GitHub DiskPond releases/assets | electron-builder publish metadata, `src/updater.ts` | Feed owner/repo set to `hoxsec/DiskPond`; updater checks automatically in packaged builds. Off switch, active-job behavior and failures remain F25/M5. |
| `MARKETING_URL` / external links | CloudBlink prompts, update download link, review alert, policy help | Default base is DiskPond's GitHub repository, but inherited suffixes are not valid DiskPond navigation. AlternativeTo still points to BlinkDisk; Kopia policy help is third-party documentation. Remove/replace inherited promotional links in M2/M5. |
| User-selected provider endpoints, S3 defaults, Rclone subprocess/remotes, SSH scanning | Provider forms, engine adapters and `src/ssh.ts` | Required BYO functionality. Provider-specific real round trips and helper detection are P01–P11 gates, not startup evidence. |
| npm registry, Go module proxy/checksum service, GitHub Electron/packager downloads | Installation and compilation | Build-time downloads. Ordinary desktop runs do not start the hosted worker/marketing stack. |

The smoke attaches Electron `session.webRequest.onBeforeRequest`, cancels remote renderer HTTP(S), and requires zero such attempts through local onboarding and the empty-destination probe. It does **not** observe all Node/Go sockets, WebSockets, OS traffic, packaged updater activity, emoji interactions or arbitrary inherited routes. DP03 remains unverified until M2/M5 network observation covers those paths.

## Discoveries requiring follow-up

1. **Discovery writes storage metadata.** The real `/api/v1/repo/exists` probe of an empty filesystem destination returned `NOT_INITIALIZED` but created `.shards`. `apps/core/internal/server/api_repo.go` also calls `format.MigrateLegacyBlobIDs` when the current format marker is absent. Therefore this inherited endpoint cannot be assumed read-only for existing repositories. M2/M3 must design and test a read-only discovery path; core changes require a deliberate compatibility decision and owned core fork. The smoke only touches a disposable empty directory.
2. **Secret persistence fallbacks remain inherited.** `src/encryption.ts` enables `basic_text` and returns `PLAIN` when secure storage is unavailable. M2 must replace that with session-only secrets and test restart/key-store failures (F24/DP01).
3. **Engine lifecycle/error logging needs review.** Status polling, chunked stderr parsing, failure cleanup and log redaction are not certified by a single successful probe. M2 must check interrupted startup/reconnect and core cache/log paths as well as the isolated Electron profile.
4. **Restore completion remains unverified.** Existing tests do not establish real restored bytes or terminal outcome semantics. Q01/Q05 must pass before the local-backup alpha is complete.
5. **Imported UI and IPC are not the final contract.** Generic storage/bridge methods, account dialogs, CloudBlink actions, permissive CSP and upstream branding remain. Narrow/validate the affected boundaries during M2 extraction; preserve backed-up repository/device-profile behavior.
6. **Installed lifecycle gap.** Packaged startup enables login launch unconditionally; the inherited uninstaller leaves that startup value and the app's URI registration behind. M1's installed smoke cleans only its own fixture entries. User startup preference, ownership-aware registration and uninstall/upgrade cleanup need F22/F26 verification in M5.

## M2 implementation order

1. Extract the required schema constants/contracts; remove API/db runtime dependencies and map remaining type-only imports.
2. Promote the existing local collections/workspace, remove online auth/sync/billing/cloud routes and their packages after callers are gone.
3. Remove analytics/crash SDKs and inherited remote UI assets; implement local diagnostic behavior and broader socket observation.
4. Implement safe create/connect, secure-storage fallback and supervised engine failures with disposable regression fixtures.
5. Complete P01/F01/F02/basic F17: snapshot A, modify/delete source data, snapshot B, restore both and compare hashes; verify restart and failure outcomes.
6. Apply original DiskPond identity/tokens and verify the keyboard/theme flow. Preserve every provider/policy field needed by later parity work.
