# Changelog

## v1.1.0

### Features

- `load: true` loads the image into the runner's Docker instead of pushing it, so later steps can
  test it before a second call pushes it
- The `ref` output names the first tag

## v1.0.0

### Features

- Build and push a repository's image to GHCR with the shared tag scheme: the branch and
  `sha-<commit>` on every build, semver tags on releases, and `latest` on the newest release
  (`latest: release`) or every default-branch build (`latest: main`)
- Refuse a release tag that isn't on the default branch
- Build without pushing for a fork's pull request
