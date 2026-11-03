# Compact Activity rows

Date: 2026-11-03. Requirements: **D14 / DP06 / DP04**, supporting **F15 / F20 / F23**. Published in **v0.1.1**. [Release verification](windows-v0.1.1.md).

## Delivered behavior

- Owner-selected individually collapsed rows replace the large backup cards below the Activity calendar. Each summary shows the folder/source name, vault, local completion time, logical size/file count and outcome. Latest known issue records use the same compact presentation in their separate section.
- Native expandable rows support Enter/Space and visible keyboard focus. Expansion reveals full names, source path/profile, full start/end timestamps, descriptions, available errors and **Open backup history** with the original vault/profile context.
- Known zero values remain zero; missing snapshot summaries and latest-issue size/count data show **Unavailable**. Failed, partial and unknown outcomes remain distinct.
- Shared theme tokens, 12px-minimum metadata and responsive rows support light/dark and 200% zoom. Full timestamps are also accessible in collapsed summaries. English copy lives in `locales/en/history.json`.
- Calendar behavior, history reads, pagination and engine/persistence contracts retain their existing semantics.

## Focused verification

Windows x64, Node **24.14.0** (supported local baseline), pnpm **11.7.0**. The existing pnpm shim under `%LOCALAPPDATA%\Temp\opencode` was used.

| Command | Result |
| --- | --- |
| `pnpm --filter @blinkdisk/desktop build` | Passed TypeScript and renderer production build. |
| `pnpm lint:ci` | Passed. |
| `node scripts/smoke-history-ui.mjs` | Passed isolated actual-component keyboard expansion/collapse, hidden-link tab order, summary metadata, unknown sizes, partial/failed details, history navigation and existing calendar/comparison flows. Long-name overflow checks passed in Dark at 200%. |
| `git diff --check` | Passed. |
| Updated documentation links and history locale JSON | Passed local link-target and JSON parsing checks. |

The fixture uses disposable data and blocks external HTTP(S). Reviewed captures are retained under `%LOCALAPPDATA%\Temp\opencode\diskpond-history-ui-nhrgCn`: `activity-rows-light.png`, `activity-rows-dark-200.png` and `activity-details-dark-200.png`. The expanded 200% flow also reaches the history link by keyboard. Owner visual feedback is next. Durable historical failure/cancellation accounting remains the separately deferred decision.
