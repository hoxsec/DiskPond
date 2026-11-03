# DiskPond — Next work

**Priority: publish the owner-authorized UI batch, then owner installation and actual-use feedback.** Follow the short [roadmap](ROADMAP.md).

1. Install the published unsigned [v0.1.0-alpha.1 prerelease](https://github.com/hoxsec/DiskPond/releases/tag/v0.1.0-alpha.1) and try backup/recovery with your chosen storage.
2. Fix concrete issues reported during actual use. Owner installation feedback remains pending.
3. The owner authorized committing/pushing the graphite/blue identity, all three return actions and feature plans to `main`, followed by **v0.1.0-alpha.2**. Local [identity](docs/verification/graphite-blue-identity.md) and [navigation](docs/verification/profile-history-navigation.md) checks pass; [release CI/publication](docs/verification/windows-alpha-2.md) is pending.
4. Next feature: **snapshot comparison** — added, changed and deleted paths with before/after sizes and modification times (DP05).
5. Then **backup activity calendar** on Home and inside each vault (DP06). [The plan](docs/plans/snapshot-comparison-and-activity.md) records the data/API work, history limitations and acceptance checks. Both features are planning-only in this pass.

The owner confirms the current app works. Use the [passing Windows baseline](https://github.com/hoxsec/DiskPond/actions/runs/41645023929); fix concrete issues as they arise. Provider and cross-platform certification is deferred.

Release automation passed [run 41654918106](https://github.com/hoxsec/DiskPond/actions/runs/41654918106) and published the first prerelease from `dd6e3c2`. All downloaded asset checksums passed. Only `main` remains; there are no open PRs. Extended certification is manual. See [release instructions](docs/windows-release.md).
