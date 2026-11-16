# GHCR Cleanup

Deletes a repository's stale container images from GitHub Container Registry without breaking
multi-platform images or images a deployment may still pull.

## What it deletes

Each tagged image is judged by its tags. One tag that keeps the image is enough to keep it.

| Tag | Kept when |
| --- | --- |
| `latest`, the default branch (`main`), releases (`1.2.3`, `1.2`, `1`, `v1.0.1`) | always |
| matching `keep-tags` | always |
| a PR's branch (`fix/x` → `fix-x`) or `pr-<N>` | the PR is open |
| `sha-<commit>` of the head of an open PR | always |
| `sha-<commit>` of a default-branch commit | newest `keep-count`, or younger than `keep-days` |
| `sha-<commit>` of any other commit | never: a superseded or closed PR build |
| anything else, such as `dev` | always: it was pushed on purpose |

A closed PR's branch tag outweighs a `sha-` tag on the default branch, because a merge commit puts
the PR's head on the default branch while the default-branch image is the merge commit's.

Untagged versions are the platform images and attestations inside a multi-platform image, or
images whose tag moved on (orphans):

- The parts of a deleted image are deleted with it, unless a kept image shares them.
- If the manifest of any kept image can't be read, nothing untagged is deleted.
- Orphans are only reported, because a deployment may pin one by digest
  (`image: app:dev@sha256:…`). Set `orphans: delete` to delete those older than
  `orphan-min-age-days`, once no deployment pins one.

Tagged images go first, then orphans, then parts, so a failed run never leaves an index pointing at
deleted platform images.

## Usage

```yaml
name: Image cleanup

on:
  pull_request:
    types: [closed]
  schedule:
    - cron: "17 3 * * 1"
  workflow_dispatch:
    inputs:
      dry-run:
        description: Only report what would be deleted
        type: boolean
        default: true

permissions: {}

concurrency:
  group: image-cleanup

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      pull-requests: read
    steps:
      # Pin the commit of a release tag such as ghcr-cleanup/v1.0.0.
      - uses: lipkau/gh-tools/actions/ghcr-cleanup@<commit sha> # ghcr-cleanup/v1.0.0
        with:
          dry-run: ${{ inputs.dry-run || false }}
```

The run's summary lists every tagged image with its verdict and the reason.

### Permission to delete

`GITHUB_TOKEN` can only delete versions of a package the repository has the **Admin** role on. On
the package's page, open **Package settings → Manage Actions access** and give the repository the
Admin role. Without it, the run stops at the first deletion and says so.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `token` | `github.token` | Needs `packages: write`, `pull-requests: read`, `contents: read` |
| `package` | repository name | Container package to clean up |
| `default-branch` | the repository's | Branch whose builds are kept by age and count |
| `keep-tags` | | Regular expression for extra tags that always keep their image |
| `keep-days` | `30` | Keep default-branch builds younger than this |
| `keep-count` | `10` | Keep this many of the newest default-branch builds |
| `orphans` | `report` | `report` or `delete` untagged images whose tag moved on |
| `orphan-min-age-days` | `30` | With `orphans: delete`, only delete orphans older than this |
| `dry-run` | `false` | Only report what would be deleted |

## Outputs

| Output | Meaning |
| --- | --- |
| `planned` | Versions selected for deletion |
| `deleted` | Versions deleted (0 in a dry run) |
