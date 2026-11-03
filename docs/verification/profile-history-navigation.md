# Profile and backup-history return navigation

Date: 2026-11-03. Requirements: **F15, F16, F20, DP04**, focused F23 / Q08 review.

## Delivered behavior

- **Back to vault** on source backup history links to the same vault, even when the page was entered directly from Home. Device/user profile filters survive the return.
- Source-card and **Browse backups** menu links preserve the selected filters. Source-card overlay links have localized accessible names and visible keyboard focus.
- **Back to all profiles** appears when either device or user is filtered. It clears both filters within the current vault and returns focus to the profile selector when present. Stale filters remain escapable when no matching sources or no profiles exist.
- **Back to backup history** on the snapshot browser returns directly to the same source's history from root or nested folders, including empty/loading views. It preserves the profile filters and removes the snapshot breadcrumb. Snapshot-card/menu links preserve those filters when entering the browser.
- History, snapshot and profile action headers wrap at constrained widths. Snapshot content fills the remaining height with scrolling available at constrained sizes. Return actions use the existing localized, square-corner shared button styling.

Implemented on top of local redesign commit `7a8a6fa`. The owner liked the initial back-button preview and requested the snapshot-to-history follow-up. That follow-up is ready for preview feedback. The published `v0.1.0-alpha.1` installer predates these changes.

The owner subsequently authorized committing/pushing all changes to `main` and publishing the next release on 2026-11-03. [The v0.1.0-alpha.2 record](windows-alpha-2.md) tracks release verification.

## Focused checks

Windows x64, Node 24.14.0, pnpm 11.7.0 and Electron 42.11.16, using the existing installed workspace.

| Command / review | Result |
| --- | --- |
| `pnpm --filter @blinkdisk/electron build:frontend` | Passed after the snapshot-to-history follow-up: desktop TypeScript, production build and frontend copy. |
| `pnpm --filter @blinkdisk/desktop test src/lib/profile.test.ts src/lib/source.test.ts` | Earlier navigation slice passed: 14 tests in 2 files; the unchanged helper result is reused. |
| `pnpm lint:ci` | Passed after the snapshot-to-history follow-up: 708 files. |
| Isolated Electron navigation fixture | Passed: same-vault direct-entry return, two vaults, source-card/menu filter preservation, device-only/user-only/combined/unmatched filters, empty profiles, keyboard return actions and selector focus restoration, Light/Dark and 200% zoom. |
| Extended snapshot-browser fixture | Passed: root/deep direct-entry return to the correct source in two vaults, snapshot-card/menu and child/parent-folder filter preservation, history-to-vault return chain, breadcrumb removal, loading/empty views and keyboard focus at 200% zoom. |
| `git diff --check` | Passed. |

The fixture loads the actual overview, source-history and snapshot-browser routes, source/snapshot lists, directory table/breadcrumb and UI components with a TanStack memory router, fixture read hooks and the production stylesheet. Unexpected backup/restore/mount/data-changing actions throw; remote HTTP(S) requests are blocked. It exercises presentation/navigation, not repository or installed-artifact recovery. Existing focused helper tests were reused.

Fixture and captures are retained locally in `%LOCALAPPDATA%\Temp\opencode\diskpond-navigation-20261103`. Re-run after building the frontend:

```powershell
node "$env:LOCALAPPDATA\Temp\opencode\diskpond-navigation-20261103\run.mjs"
```

Capture review covers `filtered-profile-light.png`, `history-light-keyboard-focus.png`, `history-dark-200-percent.png`, `filtered-profile-dark-200-percent.png` and `all-profiles-dark-200-percent-focus.png`. Capture setup waits for CSS transitions before evaluating the dark theme and explicitly resets initial zoom so reruns are independent of Chromium's saved zoom. No production theme change was needed.

The snapshot follow-up adds reviewed captures `snapshot-root-light-focus.png`, `snapshot-ready-dark-200-percent-focus.png` and `snapshot-empty-dark-200-percent-focus.png`. The history-return link remains distinct from the existing parent-folder action, with visible focus and wrapped snapshot actions.

## Manual reproduction

Use disposable fixture data with a local source and at least two other device/user profiles:

1. Open a source history directly, with Home as the previous screen. Tab to **Back to vault**, press Enter, and verify the same vault opens.
2. In that vault, filter Other profiles by device and user. Enter a source via its card, then return; repeat through its **Browse backups** menu. Both returns preserve the filter.
3. Activate **Back to all profiles**. Verify both filters clear, the other sources reappear, focus moves to **All profiles**, and the vault stays selected.
4. Repeat with only a device filter, only a user filter, a filter matching no source, and an empty profile list. The return action remains usable.
5. Repeat the return actions in Light and Dark at 200% zoom; scroll to reach the profile selector. Check visible keyboard focus and wrapped headers.
6. Open a folder snapshot from its card or **Browse files** menu. **Back to backup history** returns to that same source; **Back to vault** then preserves the original profile filter.
7. Browse into two nested folders, use the existing parent-folder action, then return to history. Verify the history URL has no snapshot breadcrumb. Repeat from a directly entered nested folder, an empty folder, and while metadata is loading.

Snapshot comparison and the activity calendar remain [planned next features](../plans/snapshot-comparison-and-activity.md). These scoped navigation checks do not close broader F15/F16/F20 or accessibility certification.
