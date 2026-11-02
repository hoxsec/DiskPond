# DiskPond artwork

`diskpond-logo.svg` and `diskpond-icon.svg` are the project owner's supplied vector artwork (2026-11-02). The graphite/silver drive geometry and outlined bold wordmark are preserved. The dark-theme wordmark changes only black to white.

Run `pnpm build:branding` from the repository root after changing either source SVG. The pinned `@resvg/resvg-js` renderer generates:

- A white-wordmark SVG for dark surfaces.
- SVG, PNG and multi-resolution ICO favicons.
- The 1024px application PNG, Windows ICO and macOS ICNS.
- Windows/Linux color tray images and a geometry-derived monochrome macOS template at 1×/2×.

Generated assets are checked in so normal application builds need no artwork conversion step. They are generated deterministically without system fonts. Do not hand-edit the generated files.

These product assets replace the inherited desktop branding. Application, engine and third-party license/attribution notices remain in their respective source files and packaged licenses.
