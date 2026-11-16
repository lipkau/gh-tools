# Changelog

## v1.0.0

### Features

* Build and push a repository's image to GHCR with the shared tag scheme: the branch and
  `sha-<commit>` on every build, semver tags on releases, and `latest` on the newest release
  (`latest: release`) or every default-branch build (`latest: main`)
* Refuse a release tag that isn't on the default branch
* Build without pushing for a fork's pull request
