# Changelog

## v1.0.0

### Features

- Delete images of closed PRs, superseded PR builds, and default-branch builds beyond
  `keep-count` and older than `keep-days`
- Keep `latest`, the default branch, releases, `keep-tags` and tags that are no PR's branch
- Delete the platform images and attestations of a deleted image, unless a kept image shares them
- Report untagged images whose tag moved on; delete them only with `orphans: delete`
- Dry run, and a run summary with the verdict and reason for every tagged image
