# Standalone pnpm desktop launcher fix

Date: 2026-11-03. Scope: **D13 / Windows development tooling**, local follow-up to v0.1.0.

## Report and fix

The owner reported `ERR_UNKNOWN_FILE_EXTENSION` for `pnpm.exe` when running `pnpm run build` and `pnpm run dev:desktop`. `scripts/lib/process.mjs` always passed `npm_execpath` to Node, which only works for JavaScript pnpm entry points. Reproduced the error with the owner's installed standalone pnpm 11.7.0.

The launcher now executes `.exe` paths directly and retains Node invocation for JavaScript entry points. A second reproduced case occurs when a nested script reports `npm_execpath=pnpm`; the launcher resolves that command through the same standalone pnpm runtime recorded in `npm_node_execpath`. Arguments and process options continue through the existing shell-free launcher.

`scripts/lib/process.test.mjs` exercises real subprocesses for CJS, ESM, native executables and nested command names, including executable paths with spaces/ampersands, literal arguments, working directories and environment forwarding. The compact Windows workflow now includes this regression command; no GitHub run was requested for this local fix.

## Verification

Windows x64; application scripts run on Node **24.14.0**, pnpm **11.7.0** in standalone and Corepack forms, Go **1.25.5**. Core pin/build: `0f31eefe409cb4f0571baf65abd7d063784598cd`.

| Command | Result |
| --- | --- |
| `node --test scripts/lib/process.test.mjs` | Passed all four subprocess cases (five TAP tests including the parent). |
| `pnpm run build` through standalone pnpm | Passed the root alias, core build, renderer/TypeScript build, frontend copy, Electron type check and main/preload production compilation. |
| `pnpm smoke:desktop` through Corepack pnpm | Passed built-app startup/onboarding, settings/theme, IPC rejection and nonmutating engine discovery. |
| `pnpm run smoke:desktop --dev` through standalone pnpm | Passed the actual development wrapper, Vite/compiler startup, isolated Electron smoke and shutdown. |
| `pnpm lint:ci` | Passed. |
| `git diff --check` | Passed. |

Smoke checks used temporary application data under `%LOCALAPPDATA%\Temp\opencode`, preserved the installed URI registration and blocked remote HTTP(S). The development smoke replaces generated main/preload output with a development build, as documented in DEVELOPMENT.md. No remaining launcher blocker was observed.
