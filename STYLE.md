# DiskPond — Design and Code Style

- **Updated:** 2026-11-02
- **Direction:** A calm, polished backup utility with an original DiskPond identity.
- **Status:** Design specification; tokens and components are implemented beginning in M2.

## 1. Design principles

1. **Recovery is the central task.** A user should always understand what is protected, when it was last backed up, and how to restore it.
2. **Quiet during normal operation, precise when attention is needed.** Favor useful status over decorative dashboards or constant notifications.
3. **Simple first, complete underneath.** Basic settings cover ordinary use; advanced settings preserve the engine's capabilities and inheritance model.
4. **Honest state.** Never imply that queued, partial, unavailable or merely configured data is safely backed up.
5. **One visual system.** Reuse tokens and accessible primitives across provider forms, policies, history and recovery.

## 2. Identity

- Display name: **DiskPond**. Use this capitalization in headings, menus, installers and prose.
- Machine identifiers: lowercase `diskpond`; M1 uses `io.github.hoxsec.diskpond` for app/URI identity and `diskpondapp` internally. Private inherited workspace package names remain until deliberate extraction/rebranding.
- Visual character: trustworthy, clear, restrained, slightly warm. Teal is the primary accent; blue denotes information/secondary emphasis.
- Use original assets. A simple pond/ripple or disk-and-water mark is a possible direction, not a completed logo requirement.
- Retain BlinkDisk/Kopia attribution in source, licenses and About; product branding is DiskPond.
- Keep surfaces flat with subtle separation. Avoid heavy gradients, glass effects, decorative charts and large promotional illustrations in working screens.
- No account avatar, cloud subscription banner, upsell, or sign-in placeholder in the local workspace.

## 3. Semantic color tokens

Implement shared CSS variables in `libs/styles` and map them to the existing Tailwind/UI semantics. Components consume roles such as `bg-background`, `text-foreground`, `bg-primary` and `border-border`; raw palette values belong in the token definition.

### Foundation palette

| Role / suggested token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#F5F8F8` | `#101918` | App canvas. |
| `card` | `#FFFFFF` | `#172321` | Panels, tables, forms. |
| `popover` | `#FFFFFF` | `#1C2D2A` | Menus, dialogs, raised surfaces. |
| `sidebar` | `#EDF3F3` | `#12201D` | Persistent navigation. |
| `foreground` | `#142827` | `#E7F0ED` | Main text. |
| `muted-foreground` | `#4F6563` | `#A7BCB5` | Secondary readable text. |
| `muted` | `#EDF3F3` | `#22352F` | Subtle grouped/disabled surfaces. |
| `border` | `#CCD9D8` | `#354C47` | Decorative dividers and card edges. |
| `input` | `#6F8782` | `#718E85` | Essential control outlines. |
| `primary` | `#0F766E` | `#5EEAD4` | Main actions and selected emphasis. |
| `primary-foreground` | `#FFFFFF` | `#082F2A` | Text/icons on primary actions. |
| `primary-hover` | `#115E59` | `#99F6E4` | Hovered primary action. |
| `accent` | `#DDF1EB` | `#193D34` | Selected row/nav background. |
| `accent-foreground` | `#115E59` | `#99F6E4` | Selected row/nav text. |
| `ring` | `#0F766E` | `#5EEAD4` | Visible keyboard focus. |

Use `foreground` for text on card/popover/secondary surfaces unless a role has its own foreground. Map secondary controls to neutral surfaces, rather than introducing another brand color. Subtle `border` is not sufficient as the only visible boundary of an input; use `input` for that role.

### Status pairs

| Status | Light foreground / background | Dark foreground / background |
| --- | --- | --- |
| Success | `#166534` / `#EAF7EF` | `#86EFAC` / `#132D22` |
| Information | `#1D4ED8` / `#EFF6FF` | `#93C5FD` / `#182A40` |
| Warning / partial | `#854D0E` / `#FFF7E1` | `#FCD34D` / `#332A17` |
| Destructive / failed | `#B91C1C` / `#FEF2F2` | `#FCA5A5` / `#381F22` |

These values are implementation starting tokens, not a substitute for checking rendered contrast. Require WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text and essential non-text controls. Check hover, selection, disabled treatment, focus and any opacity/compositing. Never use color alone to communicate a status.

Theme preference is Light / Dark / System, with System as the default. Apply the saved/system theme before the first visible frame; update live when system mode changes.

## 4. Typography, spacing and shape

### Typography

- Primary: locally bundled **Inter**, retaining its license. Fallback: `system-ui`, `Segoe UI`, sans-serif. No network-loaded fonts.
- Monospace for paths, identifiers and technical logs: `ui-monospace`, `Cascadia Code`, `Consolas`, monospace.
- Base UI: 14px / 20px. Dense table text may be 13px / 18px. Essential interaction text must not shrink to fit.
- Metadata/captions: 12px / 16px minimum, with readable contrast.
- Section title: 18px / 26px, weight 600. Page title: 24px / 32px, weight 600.
- Standard weights: 400, 500, 600. Use bold for hierarchy sparingly.
- Use tabular numerals for sizes, progress, durations and counts. Keep numerical alignment stable during updates.
- Use sentence case. Preserve case in file names, paths and provider names.

### Spacing and layout scale

- Base unit: 4px. Standard spacing: 4, 8, 12, 16, 24, 32, 48px.
- Page padding: 24px; reduce to 16px in constrained windows.
- Panel padding: 16–24px. Form field gap: 16px. Related label/help gaps: 4–8px.
- Default control height: 36px. Primary onboarding actions: 40px. Compact controls: 32px.
- Icon-only targets: at least 32×32px with an accessible label. Prefer 40px where space allows.
- Table rows: 40px standard, 36px compact; density must not remove keyboard or selection affordances.

### Shape and depth

- Inputs/buttons: 8px radius. Cards/dialogs: 12px. Pills only for compact badges.
- Borders: 1px. Focus: a visible 2px ring with offset, not a layout-shifting border replacement.
- Cards use a border; reserve restrained shadows for popovers/dialogs and overlapping elements.
- Disabled controls remain legible and communicate why an operation is unavailable when the reason is non-obvious.

## 5. Application structure

### Shell

- Windows-first desktop layout, with platform-appropriate title bar/window controls and macOS traffic-light spacing.
- Initial minimum window target: 960×640 logical pixels. At 200% zoom, use responsive stacking/scrolling so critical actions remain reachable.
- Sidebar: approximately 240px, collapsible when space is constrained.
- Top content header: title, breadcrumb/context and one primary action; avoid competing call-to-action rows.
- Scroll the relevant content pane. Keep essential restore/job context visible without trapping keyboard focus.

### Navigation

```text
Overview
Vaults
  <selected vault>
    Files & folders
    Policies
    Settings
Activity
Settings
```

Source pages contain snapshot history; a selected snapshot opens its directory browser. Restore progress appears in Activity and in the relevant source/vault context. Do not add a separate cloud-account navigation model.

### Overview and vault cards

- Lead with last successful backup, pending/active activity and items needing attention.
- Show protected data separately from storage consumed. Do not label logical source bytes as physical repository usage.
- Use actual engine/provider statistics; unavailable values display as unavailable rather than zero.
- Each vault exposes status, destination/provider, protected sources and a clear open/manage action.
- A “local destination only” observation is informational and offers a useful next action; it is not a subscription promotion or proof that data is unsafe.

## 6. Primary workflows

### First run and vault setup

1. Explain the workflow in one sentence; offer **Create vault** and **Connect existing vault**.
2. Choose storage from searchable provider cards with a recognizable name and one-line description.
3. Enter provider settings and validate the connection. Keep advanced fields available without crowding the basic path.
4. For creation, choose name and encryption password. For connection, identify the existing repository and request its password.
5. Review destination, device-specific setup and next action; choose a file or folder to protect.

Persist safe form progress during recoverable errors. Never clear every field after a failed connection. Password fields have reveal controls and copy that explains repository-password recovery accurately. Create/Connect labels must reflect different engine actions.

### Sources and policy editor

- File and folder sources share a list, with distinct icons and accurate labels.
- Source name, path, latest backup result and next scheduled action are visible without opening settings.
- Policy editor shows **scope**, **effective value**, and **Inherited / Custom** status. “Reset to inherited” is different from disabling an option.
- Basic mode: schedule and common exclusions. Advanced mode: custom schedules, retention, rule files, compression, bandwidth and supported additional controls.
- Saving basic settings must not reset advanced or inherited fields that the user did not edit.
- Show human-readable schedule summaries and the next expected run, including the relevant timezone. Explain that scheduled work depends on the desktop background process running.
- Exclusion UI shows what a rule matches, its path scope and any validation failure. Size estimates identify their assumptions and whether exclusions were applied.
- Draft policies are visibly drafts; activation and discard are explicit actions.

### Snapshot history and file browser

- History uses clear timestamps, labels, pin state, result and file/size summaries.
- Use relative time for scanning and expose full local date/time/timezone through accessible detail text. Do not rely on a hover-only timestamp.
- File browser columns start with Name, Size and Modified. Mode/UID/GID are optional advanced columns when available.
- Name search is labeled according to its real scope, such as “Filter this folder”; do not imply full-repository search without implementing it.
- Selection count and **Restore selected** remain visible. Keyboard selection is supported.
- Long names/paths may truncate in lists, with accessible full text and copy/detail access. Destructive confirmations and restore destinations must show enough context to avoid ambiguity.
- Mounted snapshots show the mount location, **Open in Explorer/Finder** and **Unmount**. Missing prerequisites get actionable instructions.

### Restore

1. Identify the snapshot/date and selected item(s).
2. Select destination and, for directory restores, unpacked files or ZIP plus compression choice.
3. Explain conflict behavior; prefer a new destination. Existing-directory overwrite requires explicit acknowledgement.
4. Show progress with item/byte counts when known. Use an indeterminate indicator when totals are unknown.
5. Report completed, partial, failed or canceled results with a stable summary and **Open destination** when meaningful.

Do not use a transient toast as the only record of restore failures or skipped files. Keep the selected snapshot and destination in the result context. Do not display 100% success before the operation's terminal result is known.

### Setup export/import

- Name it **Export setup** / **Import setup**, with “Contains settings, not backed-up files.”
- Select vaults and preview included fields. Provider credentials are excluded by default; their inclusion is explicit.
- Explain that repository passwords must be supplied separately and are not included in the package.
- Import previews new connections, duplicates and paths requiring remapping. Wrong passphrases or unsupported versions preserve current state.
- Imported configuration does not silently start backups, run hooks or overwrite local settings.

## 7. Components and interaction states

### Buttons, forms and dialogs

- One primary button per action group. Secondary actions are neutral; destructive actions use the destructive role and a specific label.
- Prefer **Back up now**, **Connect vault**, **Restore 3 items**, **Remove source** over “Submit,” “OK,” or ambiguous “Delete.”
- Keep visible field labels; placeholders are examples, not labels. Associate help/error text programmatically with inputs.
- Validate on blur/submission without repeatedly interrupting typing. Focus the first relevant error after an unsuccessful submission.
- Explain unavailable actions on remote device profiles. Do not leave users guessing at unexplained disabled controls.
- Use dialogs for contained tasks and pages for substantial multi-section settings. Restore focus to the invoking control on close.
- Use confirmation only for meaningful destructive/overwrite actions. Name the target and consequence; routine backup initiation should be immediate.

### State vocabulary

| State | Presentation and action |
| --- | --- |
| Loading | Stable-layout skeleton or progress with accessible label. |
| Empty | Explain what belongs here; offer one appropriate first action. |
| Ready / idle | Neutral; state last success and next schedule when known. |
| Queued | Explain the wait; allow cancellation when supported. |
| Running | Progress/counters and a meaningful cancel action. |
| Paused / checkpoint | Use only when the engine exposes that state; explain actual resume behavior. |
| Completed | Success icon + text + timestamp; result available for inspection. |
| Partial | Warning icon + “Completed with issues,” counts and details. |
| Failed | Error icon + plain explanation, retained details and retry/fix action. |
| Canceled | Neutral terminal result; explain any incomplete output. |
| Unavailable / offline | Explain missing source/destination/engine separately from loss of internet. |

Vault connection state and backup job state are separate. A connected vault is not proof of a completed backup. Do not label a local backup unavailable merely because the internet is offline.

### Notifications and motion

- Inline feedback for validation, persistent result panels for failures, toasts for short confirmations.
- Deduplicate repeated errors. Do not notify on every progress event or successful background poll.
- Transitions: 120–180ms for hover/focus; up to 220ms for panels. Avoid bouncing or celebratory motion during backup operations.
- Respect reduced motion. Progress changes should not shift surrounding layout; announcements should not flood screen readers.
- Use the existing Lucide icon family consistently at 16/20px with the established `Icon` suffix convention. Icons supplement text.

## 8. Accessibility and native behavior

- All critical flows work with keyboard alone and visible focus. Focus order follows reading order.
- Use semantic headings, buttons, tables, labels and dialogs. Preserve focus trapping and restoration in modal primitives.
- Provide names for icon-only controls and state text for status icons. Tooltips must be reachable through focus, not only hover.
- Announce job status transitions through an appropriate live region; do not announce every percentage change.
- Respect high-contrast/forced-color settings, reduced motion and system theme.
- Support 200% zoom without losing controls. Large file tables may scroll horizontally; surrounding forms/actions must remain usable.
- Preserve platform keyboard conventions: Ctrl on Windows/Linux, Command on macOS. Escape cancels dialogs, not running backups without an explicit action.
- Use native file/folder selection and OS-native window behavior where appropriate. Avoid a custom path picker when the OS picker already meets the need.
- Verify with Windows keyboard/screen-reader tooling first, then macOS/Linux equivalents during M6.

## 9. Voice and terminology

Write concise, plain English. Describe the actual outcome and the next useful action. Avoid promises such as “100% safe,” vague alarm messages, or success language for incomplete work.

| Term | Meaning |
| --- | --- |
| Vault | Encrypted backup repository in a selected storage destination. |
| File / folder | User-facing source type; “source” is appropriate in technical documentation. |
| Backup | User-facing point-in-time copy or the operation producing it, distinguished by context. |
| Snapshot | Technical name for a specific backup version; introduce only where useful. |
| Restore | Recover saved contents to a chosen destination. |
| Disconnect vault | Remove a local connection while leaving BYO repository data intact. |
| Delete backup | Remove a stored snapshot reference; explain later space reclamation. |
| Device profile | Repository identity for a device/user, not a hosted account. |

Examples:

- Good: **“Backup completed with issues. 2 files could not be read.”** Action: **View details**.
- Good: **“External drive unavailable. Reconnect the drive to continue.”**
- Good: **“Disconnect ‘Family archive’? Its backups will remain on your drive.”**
- Good: **“Import setup to reconnect your vaults. You will still need their encryption passwords.”**

Use “back up” as a verb and “backup” as a noun/adjective. Format dates, counts and units consistently through shared formatters. Distinguish decimal provider quotas from binary filesystem sizes where relevant; show the unit rather than relying on convention.

## 10. Implementation style

- Extend the inherited `libs/ui`, `libs/components`, `libs/forms` and `libs/styles` rather than creating a parallel component library.
- Use existing accessible primitives and variant utilities. Add a reusable component when behavior is shared, not merely to wrap every element.
- Keep presentation components focused; engine/IPC access belongs in the existing hooks/services, with runtime validation at boundaries.
- Preserve TypeScript strictness, inferred Zod types, named exports and existing formatting/lint tooling.
- Use kebab-case files, PascalCase components/types, camelCase functions, and `use...` for hooks. Follow the established schema naming convention during the fork.
- Use semantic tokens instead of inline hex values or scattered theme conditionals. Add shared roles to the token layer when necessary.
- Keep visible strings in `locales/en`; use pluralization/interpolation and avoid sentence fragments concatenated in code.
- Render paths and numeric values safely without interpreting them as HTML. Preserve copyable full values where visual truncation is necessary.
- Keep schema/engine values separate from display labels. Renaming “Balanced” must not alter a stored compression identifier.
- Follow AGENTS.md for meaningful tests and verification; simple visual changes need visual/accessibility review rather than implementation-mirroring tests.

## 11. UI acceptance checklist

Before marking a workflow visually complete:

- [ ] Light, dark and system themes use shared tokens with checked contrast.
- [ ] Keyboard navigation, focus return, names/labels and result announcements work.
- [ ] Loading, empty, active, unavailable, partial, failed and completed states are handled as applicable.
- [ ] Long paths, large counts, pluralization and 200% zoom remain usable.
- [ ] Scope, destination, last success and destructive consequences are understandable.
- [ ] Progress and statistics reflect actual engine results.
- [ ] Advanced settings survive basic-mode edits.
- [ ] No account/upsell/analytics UI remains in the desktop workflow.
- [ ] The workflow is verified with the actual desktop shell where native behavior matters.
