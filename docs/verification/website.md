# DiskPond website — D16 / WEB01

Date: 2026-11-04. Working-tree implementation on application `80e729e72927d613fc96a1fcf02be4c2e1e0e8bd`. Windows x64; Node 24.14.0, pnpm 11.7.0, pinned Astro 7.3.3 and Electron 42.11.16. Initial repository status was clean.

## Owner decision and delivered behavior

The owner requested a website with BlinkDisk's feel/features and selected optional managed backup storage. They supplied `diskpond.com`, `sales@diskpond.com`, `support@diskpond.com`, **500 GB at €5/month including VAT**, a **25% annual discount**, and a tailored enterprise tier by contact. The annual calculation is €5 × 12 × 0.75 = **€45/year**, equivalent to **€3.75/month**, VAT included.

The active Astro site is `apps/marketing/site`; English copy is in `locales/en/website.json`. It contains:

- Responsive homepage, product benefits/storage integrations, actual DiskPond screenshots with keyboard-operated tabs and a native screenshot dialog.
- Managed-storage landing page and pricing with monthly/yearly switching, correct annual total and billing-aware email enquiries.
- Current Windows release download and checksums/installation links; macOS/Linux accurately shown as planned.
- Getting-started, restore and sync-versus-backup guides, native FAQ disclosures, contact, privacy/terms and 404 pages.
- Sales/enterprise and support links; a validated email-draft composer, with fields preserved and explicit email-app behavior.
- Shared graphite/blue tokens, square corners, local Inter fonts, Light/Dark/System appearance and responsive navigation.
- Static output, canonical metadata, sitemap, robots.txt, local social image and application/third-party license notices.

The inherited marketing `src/` and `public/` are not emitted. Their upstream claims/testimonials/contacts/analytics are not relabeled as DiskPond content. No new dependency resolutions were needed. Source attribution, shared tokens/assets and the existing Astro workspace are reused.

## Checks

| Command / check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; 20 workspace projects already up to date, lockfile unchanged. |
| `pnpm build:site` | Passed; 12 HTML pages plus static social image, licenses and sitemap. Screenshot expansion produces 38 optimized WebP variants. |
| `pnpm types:site` | Passed: 25 active source files, zero errors/warnings/hints. |
| `pnpm lint:ci` | Passed across 781 files. |
| `pnpm smoke:site` | Passed all 12 routes and 69 local links/assets/anchors, with no automatic remote requests. Includes all nine screenshot views in both themes; final evidence below. |
| `pnpm unused` | Active-site findings resolved. Whole-workspace check still reports two unchanged updater fixture files (`scripts/lib/update-activity-fixture.mjs`, `scripts/lib/update-ui.tsx`) and `pwsh` in `scripts/lib/installed-update.mjs`. Inactive upstream compiler integrations/comparison API are explicitly retained in Knip configuration. |
| `pnpm dev:site` | Started successfully at `http://127.0.0.1:3000`. Homepage, cloud, pricing, downloads and licenses returned HTTP 200 with DiskPond content. |
| Built-output scan | No `blinkdisk.com`, CloudBlink, Polar, Sentry or PostHog references in emitted HTML/JS/XML/text. Attribution to the upstream projects remains. |
| Visual review | Actual light/dark desktop, mobile homepage/cloud, annual-pricing and social-image captures reviewed. Caption/control text uses a 12px minimum. |
| `git diff --check` | Passed. |

The shell initially lacked pnpm on PATH. Commands used the existing `C:/Users/HOXSEC/AppData/Local/pnpm/bin` shim, added to the command environment for nested root scripts. An initial simultaneous Astro type/build invocation raced the shared Vite cache on Windows; sequential commands pass and the requirement is documented. A missing Lucide alias was corrected to the installed `code-xml` icon before the passing build/type checks.

## Browser fixture

`scripts/smoke-site.mjs` launches a loopback-only static server and an isolated Electron browser profile. It never starts the desktop backup app or accesses user repositories. Screenshots and machine-readable results are retained under `%LOCALAPPDATA%/Temp/opencode/diskpond-site-*`.

Initial website evidence: **`diskpond-site-Lh5bBJ/result.json`**. Final screenshot-expansion evidence: **`diskpond-site-4DEYxM/result.json`** and screenshots in that directory. Verified:

- Gallery Arrow keys/Home/End, selected panel, dialog Escape and focus return; FAQ Enter open/close.
- All nine screenshot views show exactly one theme image, open its full-resolution counterpart with matching alternative text, and restore keyboard focus on Escape. An open dialog follows live system-theme changes.
- Monthly/annual radio keyboard interaction, €3.75 monthly equivalent, €45 billed annually, and matching encoded sales enquiry.
- Invalid-contact focus, safe encoding of `&`, `?` and `€`, enterprise versus support routing, retained message text. Mail navigation is intercepted; no email is sent by the fixture.
- Appearance persistence across navigation, live system-theme changes, and operation with local storage access throwing `SecurityError`.
- Desktop plus Light/Dark 200% reflow, 390px and 320px layouts across all pages. Rendered text contrast meets the checked WCAG AA thresholds; this is not a full assistive-technology audit.
- Native FAQ keyboard behavior with JavaScript disabled, visible monthly email enquiries, and the enhancement-only billing toggle staying hidden.
- All discovered local links/assets/anchors, custom 404, sitemap and social image. No automatic remote requests or observed browser console errors.

Earlier enhanced-fixture runs exposed test-harness issues: Electron blocks JavaScript evaluation when testing JavaScript-disabled pages, its native Enter path requires the character event, and background windows can throttle animation frames. The final fixture uses native DevTools DOM inspection, a complete Enter event and disabled background throttling. Settled transition screenshots were reviewed in both themes.

## Screenshot and connectivity expansion

The owner requested fresh screenshots for the website and README, plus more visible connectivity and feature coverage (WEB01 / DP04; presentation of P01–P11, F08–F18 and DP05–DP06).

- **18 fresh PNGs / nine views**, in Light and Dark: vault overview, comparison, Activity, policy editor, snapshot browser, restore dialog, and three positions in the real storage picker (local, cloud and remote).
- `scripts/capture-readme.cjs` creates Documents, Projects, Designs and Receipts under a disposable mapped drive, with five real snapshots including two versions of Documents. The engine produces the counts, sizes, comparison and retained history; demo identity is `sam@desktop`.
- Full-window captures are 1440 × 960. Comparison and Activity use 80% app zoom. Restore/provider dialogs are cropped to their actual rendered bounds. UI content is not replaced or mocked for the images.
- The homepage retains three hero tabs and adds visible schedule/exclusion, browsing/recovery and connectivity showcases. Responsive WebP images follow the site's Light/Dark/System preference and open at capture resolution. Gallery images preserve the full captured frame.
- All **11 available connections** are named: internal/local, external, network/NAS, Amazon S3, S3-compatible, B2, GCS, Azure Blob, SFTP, WebDAV and Rclone. NAS/Windows share and separately configured Rclone boundaries are stated.
- README uses theme-aware `<picture>` pairs for all nine views, expands its feature descriptions and updates the release label to v0.1.4.

Capture/check evidence:

| Command / check | Result |
| --- | --- |
| `pnpm --filter @blinkdisk/electron prebuild` | Passed; rebuilt renderer/main/preload. Existing native binary matches core pin `0f31eefe409cb4f0571baf65abd7d063784598cd`. |
| `node scripts/capture-readme.mjs` | Passed; four sources, five snapshots, two-version comparison and cold-start comparison labels; all 18 captures saved. Temporary profile/storage/drive mapping cleaned. |
| Website build/types/lint/browser checks | Passed as listed above; final browser record `diskpond-site-4DEYxM/result.json`. |
| README asset check | All 20 local image references (two logos plus 18 screenshots) resolve. |
| Visual review | Light/Dark desktop screenshots, scheduling/recovery/connectivity sections and mobile layouts reviewed. The mobile storage screenshots span the card width. |
| Development preview | `http://127.0.0.1:3000/` returns current screenshot and 11-connection content. |

The first capture attempt used the wrong theme-class element and encountered Windows frame throttling; the driver now waits for the actual desktop body theme and keeps frames active. Website capture diagnostics also identified native window occlusion (`visibility: hidden`, no animations) during an earlier timed-out run. The fixture disables native occlusion, reapplies background-throttling control after navigation, bounds evaluations, and waits for image decoding and repaint before screenshots. Visual review caught and corrected a narrow mobile grid column before final passing verification.

These captures demonstrate the existing UI. Restore execution and remote-provider certification remain covered by their separate acceptance records; this fixture captures restore controls and provider choices. Desktop runtime code, repository format and core pin are unchanged.

## Actual launch status

This is a locally verified **prelaunch website**, not an operating managed-storage service. Cloud plans are marked coming soon and route to email enquiries. No messages are submitted to a website backend, no payment is collected, and no storage is provisioned. Seller identity/service terms, checkout provider/URLs, storage provisioning/connection design and actual service readiness remain WEB02 work. Email delivery and ownership/configuration of the supplied mailboxes/domain have not been verified.

Static-host deployment/DNS is pending. The owner subsequently authorized branch/merge publication and **v0.1.5**; [release progress and checks](windows-v0.1.5.md) track that work. [Run/deployment instructions](../../apps/marketing/README.md). Desktop backup/restore/IPC/crypto behavior and the core pin are outside this website slice.
