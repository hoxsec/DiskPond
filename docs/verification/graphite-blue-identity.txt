# Graphite / blue desktop identity

Date: 2026-11-03. Requirements: **D10, DP04, F23**, with focused Q08 review.

## Owner choices and implementation

- Graphite dark surfaces, white/light-gray light surfaces and blue accents.
- Clean technical presentation: square buttons, inputs, panels, menus and badges; flat bordered vault cards with provider and connection status.
- Shared radius tokens cover all inherited size variants. Explicit pill/fixed-radius controls, scrollbars, skeletons and toasts follow the square shape.
- Existing silver drive icon and DiskPond wordmark; existing local fonts.
- Light / Dark / System selection remains in Settings, with System the default. Native startup background matches the updated theme canvas.
- Toasts follow the selected theme and semantic status colors.

The design was implemented against application `532a9ad50404e0d5d247652b5bedf71088f85411`, after `v0.1.0-alpha.1`; that published installer still has the previous design. On 2026-11-03 the owner approved the visual changes and authorized committing them locally, with pushing deferred.

The resulting identity commit is `7a8a6fa`. Later on 2026-11-03 the owner authorized pushing the complete identity/navigation batch and publishing the next release; see [v0.1.0-alpha.2 verification](windows-alpha-2.md).

## Contrast review

Calculated sRGB/WCAG contrast from the shared tokens, including primary hover and secondary hover surfaces:

| Pair | Light | Dark |
| --- | --- | --- |
| Main text / canvas | 15.40:1 | 15.43:1 |
| Muted text / canvas | 6.21:1 | 8.53:1 |
| Muted text / secondary hover (lowest reviewed neutral-text pair) | 5.27:1 | 5.22:1 |
| Primary button text / primary | 6.70:1 | 6.96:1 |
| Primary button text / hover | 8.72:1 | 9.26:1 |
| Selected text / accent | 7.57:1 | 7.06:1 |
| Input outline / secondary surface | 3.18:1 | 4.06:1 |

Foreground/muted text were checked against canvas, card, popover, muted/secondary, secondary hover and sidebar surfaces. Status text was checked on canvas and card. These pairs pass 4.5:1 for normal text and 3:1 for essential control outlines. This is a focused palette review, not full application accessibility certification.

## Checks

Local Windows x64 review used Node **24.14.0** (the supported local baseline), pnpm **11.7.0** and Electron **42.11.16**. The existing core binary reports `0.0.0-diskpond-dev`, revision `0f31eefe409cb4f0571baf65abd7d063784598cd` from `hoxsec/diskpond-core`.

| Command / review | Result |
| --- | --- |
| `pnpm --filter @blinkdisk/electron prebuild` | Passed: desktop TypeScript/build, copied frontend, Electron TypeScript and main/preload production compilation. |
| `pnpm --filter @blinkdisk/electron build:frontend` | Passed after the final toast-color correction. |
| `pnpm --filter @blinkdisk/ui types` | Passed. |
| `pnpm lint:ci` | Passed, 708 files. An initial formatting-only error in `input-group.tsx` was corrected. |
| `pnpm smoke:desktop` | Passed: keyboard onboarding, provider dialog and focus return, Settings Light/Dark changes, live System changes, saved theme after reload, 200% navigation/scrolling, isolated engine discovery and no remote renderer/main-fetch requests. |
| `node scripts/smoke-restore-ui.mjs` | Passed: all restore outcomes, keyboard cancel/dismiss, both themes, long paths and 200% zoom in the existing isolated component fixture. |
| `git diff --check` | Passed. |
| Token contrast and rendered review | Reviewed Settings, provider dialog and zoom captures, plus a disposable component gallery with all four vault connection states, long names, button variants/focus/disabled state, invalid input, checkboxes, radios, switches, badges, progress, skeletons, alerts and toast actions. Both gallery themes had zero nonzero HTML corner radii and no horizontal overflow. Toasts reported the correct active theme. |

The gallery uses the actual shared components and `VaultCard`, with fixture vault statuses and the built stylesheet; it is visual evidence, not repository/backup certification. It caught Sonner's default action/close colors overriding normal Tailwind utilities; explicit overrides now use the shared palette. Final light/dark captures were reviewed after that correction. The temporary gallery's theme-selector wait and background frame throttling were corrected during capture setup.

Screenshots and the disposable gallery remain under `%LOCALAPPDATA%\Temp\opencode\diskpond-identity-20261103`:

- `desktop/settings-light.png`, `desktop/settings-dark.png`, `desktop/providers.png`.
- `desktop/settings-200-percent.png`, `desktop/providers-200-percent.png`, `desktop/about-200-percent.png`.
- `components-light.png`, `components-dark.png`, `component-review.json`.

The direct smoke entry point displays the Electron runtime version in About, as in the earlier branding fixture. Reproduce the desktop captures using the built frontend and isolated smoke profile:

```powershell
$env:DISKPOND_TEST_TMP = "$env:LOCALAPPDATA\Temp\opencode"
$env:DISKPOND_SMOKE_CAPTURE_DIR = "$env:DISKPOND_TEST_TMP\diskpond-identity-20261103\desktop"
corepack pnpm smoke:desktop
```

No new implementation-mirroring unit tests were added for this visual slice. The focused checks above pass and the owner approved the visual changes. Full workflow/screen-reader certification remains deferred under D13.
