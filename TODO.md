# DiskPond — Next work

**Priority: Windows release CI/CD.** Follow the short [roadmap](ROADMAP.md).

1. Verify the implemented compact Windows workflow in GitHub on `main`; the owner authorized committing, pushing, merging and branch/PR cleanup.
2. With publication authorization, tag **v0.1.0-alpha.1** (owner-approved unsigned prerelease).
3. Confirm downloadable installer/assets and owner installation; then close the Now release task.

The owner confirms the current app works. Use the [passing Windows baseline](https://github.com/hoxsec/DiskPond/actions/runs/41645023929); fix concrete issues as they arise. Provider and cross-platform certification is deferred.

Release automation is implemented in `.github/workflows/release.yml`, sharing the compact `.github/workflows/desktop.yml` check. Extended certification moved to manual `.github/workflows/desktop-extended.yml`. No tag or release has been published. See [release instructions](docs/windows-release.md).
