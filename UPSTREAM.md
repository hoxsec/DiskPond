# DiskPond upstream provenance

Updated 2026-11-02. DiskPond is derived from BlinkDisk and its Kopia-derived core.

| Component | Exact baseline | License |
| --- | --- | --- |
| Application | [`blinkdisk/blinkdisk@e435469b3d09b8c217417d1325331865e483ce2f`](https://github.com/blinkdisk/blinkdisk/tree/e435469b3d09b8c217417d1325331865e483ce2f) | AGPL-3.0, retained in [LICENSE](LICENSE) |
| Engine submodule | [`blinkdisk/core@e8955e7280edd9526b9f104f1592f233cfe6789b`](https://github.com/blinkdisk/core/tree/e8955e7280edd9526b9f104f1592f233cfe6789b) | Apache-2.0, retained in [apps/core/LICENSE](apps/core/LICENSE) |

Credit and copyright remain with their respective contributors. Kopia provides the underlying backup engine; see [kopia/kopia](https://github.com/kopia/kopia). Bundled dependencies and assets retain their own licenses. This document records the fork; it does not replace those terms or grant use of upstream trademarks.

## Import record

The import started from DiskPond commit `ef03111` on `integrate/blinkdisk-baseline`. Existing history, `.gitattributes`, and DiskPond's four planning/contributor documents were preserved. The upstream application commit and its ancestors were fetched into the local repository, with a local reference at `refs/remotes/upstream/diskpond-baseline`. The owner authorized committing and pushing this integration branch for Windows CI. The import commit retains both `ef03111` and the pinned upstream application commit as parents; the following commit records the Windows adaptations and DiskPond documents. No tag or binary release is part of this CI handoff.

Remotes used:

- `origin`: `https://github.com/hoxsec/DiskPond.git`
- `upstream`: `https://github.com/blinkdisk/blinkdisk.git`
- `apps/core`: `https://github.com/blinkdisk/core.git`, detached at the gitlink above.

The recorded procedure was:

1. Create the integration branch from existing DiskPond history.
2. Fetch the exact application commit with `git fetch --no-tags upstream <application-commit>`; record the local baseline ref.
3. Materialize its tree into the working directory, excluding DiskPond's `AGENTS.md`, `.gitattributes`, `PLAN.md`, `ROADMAP.md`, and `STYLE.md`.
4. Record `.gitmodules` and the exact `apps/core` gitlink; run `git submodule update --init --depth 1 --checkout apps/core`.
5. Enforce LF checkout in `.gitattributes`; retain the inherited workspace layout, package exports, lockfile, dependency patch and copyright/license headers.
6. For the CI handoff, record the upstream tree with the original DiskPond `.gitattributes` as a two-parent import commit, then record the reviewed working tree as the adaptation commit. Temporary Git indexes prepare these trees without replacing the working files or planning documents.

Do not replay the tree import over later work. A future clone recreates the core using the committed gitlink, not `--remote`. The upstream `branch = main` hint was removed from `.gitmodules`. The core build checks the checkout against the index gitlink before compiling.

## DiskPond modifications to upstream application files

These changes are dated **2026-11-02**, during M1. Review them independently of the source import. The core source has no DiskPond modifications.

| Area | Changed inherited files / purpose |
| --- | --- |
| Contributor and user documentation | `AGENTS.md` reconciles upstream guidance with account-free DiskPond decisions; `CLAUDE.md` still references it. `README.md`, `DEVELOPMENT.md`, and `.env.template` replace service-era setup/product instructions. |
| Tooling | Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and both desktop/electron manifests establish desktop commands and remove desktop Sentry upload-plugin dependencies. `knip.config.ts` recognizes packaging/scripts; `libs/biome/no-cross-package-alias.grit` recognizes Windows separators. |
| Identity / packaging | `libs/constants/src/app.ts`, `apps/electron/electron.builder.ts`, `src/path.ts`, `src/window.ts`, `src/startup.ts`, `src/tray.ts`, and `apps/desktop/index.html` use DiskPond runtime, storage, startup, URI and artifact identities. Workspace-only `@blinkdisk/*` names are retained initially. |
| Development isolation | `apps/electron/src/deeplink.ts` restricts OS URI registration to packaged builds so dev/preview runs preserve the installed handler; `src/deeplink.test.ts` covers registration, failure reporting and link handling with the DiskPond scheme. |
| Build / initial privacy defaults | `apps/desktop/vite.config.ts`, `apps/electron/esbuild.config.mjs`, their `src/main.tsx` / `src/index.ts` / `src/preload.ts`, and `apps/desktop/src/hooks/use-logsnag.ts` disable desktop Sentry initialization/uploads and analytics keys/LogSnag transmission. Full SDK/service removal remains M2. |
| Windows regression assertions | `apps/electron/src/path.test.ts`, `src/db/sync.test.ts`, and `apps/desktop/src/lib/number.test.ts` cover native paths, engine locations and locale-aware formatting. |
| CI | Nine inherited deployment/quality workflows are replaced by `.github/workflows/desktop.yml`, a secret-free Windows desktop/core check with no publishing step. |

New implementation files are `scripts/` build/dev/smoke runners, `libs/constants/src/core.ts`, `apps/electron/src/identity.ts`, and `docs/verification/`. Original planning files continue to track actual milestone progress.

The lockfile was regenerated with pnpm 11.7.0 after removing the two desktop upload-plugin imports. The resulting diff removes the unused esbuild plugin, collapses duplicate existing optional `@emnapi/runtime` peer snapshots to the already-locked 1.11.3 resolution, and refreshes two deprecation annotations. No broad dependency update was requested. Use frozen installation thereafter.

## M2 branding/local-workspace changes

The owner-supplied DiskPond SVG wordmark/drive icon replaces inherited product artwork in the shared logo, favicons, native app/installer and tray. `scripts/build-branding.mjs` generates the derivatives with pinned resvg. Shared light/dark tokens follow STYLE.md.

Desktop auth/account switching, CloudBlink, billing, quotas, promotions and telemetry UI/hooks are removed. Electron no longer imports hosted auth/sync/tRPC clients, token migrations, hosted API proxying or Sentry. Local collection filenames and encrypted configuration formats are retained; a local-only migration selects the workspace without touching dormant hosted account collections. Shared config-level/vault-status contracts no longer import the hosted database schema. Engine source/gitlink and license material are preserved.

Verification and outstanding M2 work: [branding/workspace record](docs/verification/m2-branding-workspace.md). Retained service applications and their own dependencies are not desktop deliverables.

The M2 lockfile was regenerated with pnpm 11.7.0 from the baseline resolutions. Its only new package family is the pinned artwork renderer `@resvg/resvg-js@2.6.2` and platform bindings; removed entries follow the retired desktop dependencies. The local-engine cookie dependencies remain at `tough-cookie@6.0.1` and `tldts`/`tldts-core@7.4.4`.

## Distribution and later updates

DiskPond's source/release namespace is `hoxsec/DiskPond`. Runtime identifiers are documented in [the M1 evidence](docs/verification/m1-windows-baseline.md). Existing BlinkDisk settings are not imported automatically.

Before distributing binaries, publish matching application and core source, build instructions, license/copyright material, dependency notices and checksums. Current development packaging includes both project license texts, owner artwork and this provenance record; a complete third-party notice review and release signing remain M5 gates. Build instructions are in [DEVELOPMENT.md](DEVELOPMENT.md).

Review upstream fixes deliberately. Advance application/core pins with compatibility evidence, rather than replacing the fork with stock Kopia or following a moving engine branch.
