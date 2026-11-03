# DiskPond — Next work

**Priority: Windows release CI/CD.** Follow the short [roadmap](ROADMAP.md).

1. Implement tag-triggered Windows packaging and GitHub Release uploads using the existing build scripts.
2. Keep one compact release check; make extended certification suites manual.
3. Confirm first version/tag and signing availability, document installation/recovery, then publish the first prerelease.

The owner confirms the current app works. Use the [passing Windows baseline](https://github.com/hoxsec/DiskPond/actions/runs/41645023929); fix concrete issues as they arise. Provider and cross-platform certification is deferred.

Release automation is **not implemented yet**: `.github/workflows/desktop.yml` currently checks/builds the app but does not publish a release.
