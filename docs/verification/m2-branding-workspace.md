# M2 slice — DiskPond branding and local workspace

Date: 2026-11-02. **Branding/workspace slice implemented and locally verified; M2 recovery gate open.** Initial local verification used changes on `integrate/blinkdisk-baseline`, based on `31b4f9668d18cd9f55fcf3b9272cbd5d2e3e3704`; the subsequent source publication is recorded below. Pinned core remains `e8955e7280edd9526b9f104f1592f233cfe6789b`.

## Scope and requirements

Owner-approved original SVG branding plus removal of inherited sign-in, CloudBlink and billing screens. This implements part of **DP01, DP03, DP04, F23 and F24**, applying exclusions **X01–X05** to the desktop runtime, with supporting Windows native/packaging evidence for **F22/F26**. M2's **P01/F01/F02/F17 recovery gate remains open**.

- Canonical owner artwork in `libs/assets/brand`; generated dark wordmark, favicons, native PNG/ICO/ICNS and tray images. Shared neutral/teal light/dark tokens and persisted theme/language preferences.
- One local workspace. First launch uses **Open DiskPond**; existing local settings/vaults remain accessible. Account settings become local preferences/About. Provider selection opens directly with BYO storage. Disconnect copy describes retained backups.
- Removed desktop auth, account switching/transfers, CloudBlink, subscriptions, billing, quotas and promotional surfaces. Removed main/preload hosted auth/sync/tRPC, token migrations and internal API proxy. Legacy auth deep links are ignored; hosted collections are not initialized. Native mapping rejects managed-storage providers/aliases.
- Removed desktop/main/preload PostHog, LogSnag and Sentry execution/dependencies. Shared vault/config contracts are independent of the hosted database schema. Service-only locales are excluded from desktop assets. Retained service apps remain outside desktop runtime/build entry points.
- Source/engine licenses and readable BlinkDisk/Kopia attribution remain in About and packaged notices.

## Persistence behavior

`workspace_v1` selects `local` and recognizes prior skipped-login/local-collection setups. Existing local collection names (`local/vault`, `local/config`), filenames, passwords and preferences are preserved. Hosted account records/config files remain dormant on disk; they are not imported into local storage, synchronized, decrypted or deleted. No BlinkDisk application profile is imported. Stored repository/config encryption formats are unchanged.

Regression coverage exercises fresh/existing/idempotent migration, overlapping local initialization, persistence failure/retry, ignoring hosted collections during engine startup, retired API/deep-link rejection, and provider alias rejection. Local BYO mappings retain inherited fields/aliases.

## Verification

Local environment: Windows 11 Pro x64, build 26200; Node 24.14.0, pnpm 11.7.0, Go 1.25.5; Electron 42.11.16 and electron-builder 26.15.3. Repository Node pin remains 24.15.0. No hosted service, account, database or signing certificate is required for the exercised desktop path.

### Source and development checks

| Command / inspection | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --no-optimistic-repeat-install` | Pass. Lockfile regenerated through pnpm; the only new resolution family is `@resvg/resvg-js@2.6.2` and its platform bindings. Existing `tough-cookie@6.0.1` and `tldts`/`tldts-core@7.4.4` remain pinned. |
| `pnpm build:branding` | Pass. Generates the dark wordmark, favicon, PNG/ICO/ICNS and tray derivatives from the two canonical SVGs without system fonts. |
| `pnpm types` | Pass for desktop, Electron and libraries with type-check scripts. |
| `pnpm test` | Pass: **495 tests across 49 files**. Retired hosted auth/sync tests were removed alongside their implementation; workspace, migration, provider and retired-route regressions are included. |
| `pnpm lint:ci` | Pass: **672 files**. |
| `pnpm unused` | Pass across the retained workspace, including service sources. |
| `pnpm smoke:desktop --dev` | Pass through the actual development wrapper: Vite, main/preload compilation, Electron, isolated data and process cleanup. No remote renderer HTTP(S) or main-process `fetch` requests observed. |
| Emitted dependency/asset inspection | 97 final production JS/JSON files checked for retired API/telemetry references; no matches for the audited integrations. Locale and favicon destinations exist at the expected paths. |

The expanded built/development smoke exercises Enter-key onboarding, direct BYO provider selection, Escape and focus return, Settings navigation, actual Light/Dark/System selection, live system-theme changes, compact navigation and scrolling at 200% zoom, persisted workspace/theme after renderer reload, legacy account-route redirection, rejected hosted API access, and real-engine discovery. It verifies that auth/sync methods are absent from preload and that the public Windows URI registration is unchanged. Reload persistence is not an interrupted-job or full application-restart recovery test.

Discovery uses an empty disposable destination and confirms `NOT_INITIALIZED` plus the inherited `.shards` marker. No real repository or developer source files are used. This is engine discovery evidence, not snapshot/restore evidence.

### Visual and interaction review

Final built and development captures were reviewed for welcome, empty workspace, provider selection, light/dark Settings, and the 200% Settings/provider/About layouts. The wordmark is black on light surfaces and white on dark surfaces; the supplied silver/graphite drive is preserved. Compact navigation keeps Home and Settings reachable at 200%; provider dialogs and About content scroll. Captures wait for fonts, visible images, transitions and animation frames.

The smoke wrapper launches a JavaScript entry point directly, so its About captures display Electron's `42.11.16`. The installed artifact separately reports the actual development app version `0.0.0` through IPC.

Token contrast calculations passed the checked pairs in both themes: foreground/background and foreground/card, muted text on background/card, primary text at rest/hover, accent text, destructive text, input/secondary boundaries and focus ring/background. Minimum checked text contrast was **5.47:1 light / 7.98:1 dark**; input boundaries were **3.43:1 / 3.65:1**, and focus ring/background **5.13:1 / 12.09:1**. These are token-pair checks, not full screen-reader, compositing or workflow certification.

Local captures are retained under the session temporary directory, `diskpond-m2-captures/dev` and `diskpond-m2-captures/built`, rather than committed machine-specific evidence. To reproduce the final built captures after packaging:

```powershell
$env:DISKPOND_TEST_TMP = $env:TEMP
$env:DISKPOND_SMOKE_CAPTURE_DIR = Join-Path $env:TEMP 'diskpond-m2-captures/built'
pnpm smoke:desktop
pnpm smoke:windows
```

Use a Windows test user without existing packaged DiskPond data/install/registration for installed smoke. Development smoke uses temporary data, distinct from the preserved `%APPDATA%\diskpond-dev` profile.

### Corrections found during verification

- Fixed the Settings row's missing child and rendered the shared logo in About.
- Corrected Vite static-copy paths with `rename: { stripBase: true }`, included the default translation namespace, and fixed favicon destinations. Earlier builds displayed translation keys; those builds are superseded.
- Centered welcome across the full window and added small-viewport navigation, scrolling, a provider-search accessible name and a larger Back target.
- Corrected smoke key-event/link selection and synchronized screenshots with rendering; earlier screenshots captured stale animation frames.
- Forced pnpm's non-optimistic install after restoring baseline resolutions; optimistic repeat-install had skipped lockfile regeneration.

### Final Windows production verification

The final run passed `pnpm build:windows` → `pnpm smoke:desktop` → `pnpm smoke:windows`, after the development smoke had passed. Packaging rebuilt production main/preload and frontend, including the locale and compact-navigation fixes. Publishing was disabled with `--publish never`.

| Scenario | Observed result |
| --- | --- |
| Production build | Pinned Windows core, renderer, main/preload, copied assets, x64 `win-unpacked` and NSIS installer built successfully. |
| Built smoke | Account-free interaction checks above passed using `diskpondapp://frontend`; no remote renderer HTTP(S) or main-process `fetch` requests observed. Final screenshots reviewed. |
| Installed smoke | Disposable silent NSIS installation, first launch, **Open DiskPond**, no auth/sync preload methods, `0.0.0` version IPC, packaged engine discovery, icon resource, license texts, DiskPond update metadata and normal quit passed. |
| Native/resource inspection | Extracted application and installer icons show the supplied drive. Packaged icon/tray files, application/core license texts and `UPSTREAM.md` match their source bytes; packaged engine matches the built core. |
| Uninstall/cleanup | Installed executable removed and marked fixtures cleaned. Inherited startup/URI registrations remained after uninstall; the harness recorded the gap and removed only entries pointing to its fixture. Full uninstall acceptance remains open. |

Post-smoke inspection confirmed no packaged fixture data, no smoke/install fixture directories and no DiskPond startup/URI registrations. The existing development profile was preserved, and the pinned core source remained clean. Documentation review passed 41 local links across nine files and `git diff --check`.

Informational inherited build warnings include Node module-type inference for the shared TypeScript helper, Vite tsconfig-paths/plugin timing notices and packager optional dependencies for other platforms. They did not fail these Windows checks.

#### Development artifact hashes

These identify the final locally verified artifacts, not a published release or a promise of byte-identical builds. Installer size: **117,979,420 bytes**. Authenticode reports **NotSigned** for both installer and application.

| File | SHA-256 |
| --- | --- |
| `apps/electron/dist/DiskPond-Windows.exe` | `d9d3f2e8f0a96c85489dc7874278dbaf18915a49147d8d070da33dee7f495fea` |
| `apps/electron/dist/win-unpacked/DiskPond.exe` | `bbe2726028a72f90786450ed575bec855c1c89476ac2564d9266e6f09d725c9b` |
| `apps/electron/dist/win-unpacked/resources/app.asar` | `6552b696a71d30a4acf85caaa99e6fbeb6e1acc92e2bc6bfdf97fe944f09f49b` |
| `apps/electron/dist/win-unpacked/resources/binaries/kopia.exe` | `215c1571c78b1aaf1a00ba20293962141f83f8461a6c47f3eb7e7cae67c1df10` |
| `apps/electron/icon/icon.ico` | `9f68cff4ac1bcb26fc10c79989f53a1f5f1a4565e7c4bc4943b2a32631e715aa` |

For owner inspection, `pnpm dev:desktop` was restarted using the preserved `%APPDATA%\diskpond-dev` profile; Vite and Electron started and `workspace_v1` completed successfully. This rebuilds loose core/main/preload outputs for development; the installer and `win-unpacked` artifacts above retain the verified production build.

### Source publication

The owner subsequently authorized committing, pushing, merging into `main`, and continuing in a new session. The integration branch was published with separate commits:

- `456e7ac` — owner artwork, generated native assets and theme foundation. Its intermediate lockfile was generated with pnpm from the staged branding manifests; no lockfile internals were hand-edited.
- `30ab2f8` — account-free desktop, hosted-service extraction and the local verification record above.
- `46adcec` — merge of the preserved M1/M2 integration history into `main`.

[Windows CI run 41531622284](https://github.com/hoxsec/DiskPond/actions/runs/41531622284) for `30ab2f8d8447ab967d04fb5333a5f9d3477b5d75` **passed** in 6m10s. The merged-main [run 41531861201](https://github.com/hoxsec/DiskPond/actions/runs/41531861201) for `d63593263db0a8f60b8b56240873a35b65009643` **passed** in 7m06s. Both were followed with `gh run watch --exit-status` and confirmed with `gh run view`: frozen install, lint, types, tests, dependency analysis, Windows packaging and built/development/installed smoke all passed. These certify the published branding/workspace slice, not subsequent uncommitted work. No tag or binary release was published.

## Remaining gates

- Real local backup/restore/versioned recovery and interruption/restart certification remain M2 work. Existing discovery still writes `.shards` and can migrate old blob IDs; safe create/connect separation remains open.
- Subsequent [vault-password/session-only](m2-password-storage.md) and [approved provider-storage](m2-provider-storage-design.md) slices address inherited credential fallbacks and active desktop provider JSON/envelope persistence. They remain uncommitted and locally verified. Renderer restore terminal outcomes and the complete desktop recovery gate remain open.
- Packaged updater behavior still uses the DiskPond feed; opt-out/preference and full network-capture matrix remain open. Smoke observation covers renderer HTTP(S) and main-process `fetch`, not every OS/sidecar socket.
- Redacted diagnostics export and encrypted setup export/import remain planned. Full accessibility/screen-reader workflows, installed upgrade matrix, signing, macOS and Linux runtime verification remain later gates.
