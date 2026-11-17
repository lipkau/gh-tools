# Container Image

Builds a repository's container image and pushes it to GHCR, tagged the same way in every
repository. It checks out the repository itself unless `checkout: false`.

## Tags

| Build                | Tags                                             | `latest` too           |
| -------------------- | ------------------------------------------------ | ---------------------- |
| Pull request         | the branch (`feat/x` → `feat-x`), `sha-<commit>` | never                  |
| Default branch       | the branch (`main`), `sha-<commit>`              | with `latest: main`    |
| Release tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `v1.2.3`, `sha-<commit>`    | with `latest: release` |

- `latest: release` (the default) gives `latest` to the newest release without a pre-release part,
  so `v1.3.0-rc.1` doesn't get it. A release tag must point at a commit on the default branch.
- `latest: main` is for repositories that don't cut releases.
- A pull request's `sha-` tag names its head commit, not GitHub's merge commit.
- [ghcr-cleanup](../ghcr-cleanup/) deletes these tags again once a pull request closes.

A fork's pull request gets a read-only token, so its image is built but not pushed.

## Usage

Run it as a job in `ci.yml` after the checks, and add it to the `CI result` job's `needs`:

```yaml
on:
  pull_request:
  push:
    branches: [main]
    tags: ["v*"]

jobs:
  image:
    needs: [checks]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      # Pin the commit of a release tag such as container-image/v1.0.0.
      - uses: lipkau/gh-tools/actions/container-image@<commit sha> # container-image/v1.0.0
        with:
          latest: release
```

## Inputs

| Input          | Default                   | Meaning                                                      |
| -------------- | ------------------------- | ------------------------------------------------------------ |
| `latest`       | `release`                 | `release` or `main`: which build gets `latest`               |
| `image`        | `ghcr.io/<owner>/<repo>`  | Image name without a tag                                     |
| `platforms`    | `linux/amd64,linux/arm64` | Platforms for default-branch and release builds              |
| `pr-platforms` | `platforms`               | Platforms for pull requests, such as `linux/amd64` for speed |
| `context`      | `.`                       | Build context                                                |
| `file`         | `<context>/Dockerfile`    | Dockerfile                                                   |
| `target`       | last stage                | Build stage to export                                        |
| `build-args`   |                           | Build arguments, one `NAME=value` per line                   |
| `checkout`     | `true`                    | `false` when the job already checked out the commit to build |
| `fetch-depth`  | `1`                       | Commits to check out; `0` for the full history               |
| `push`         | `auto`                    | `auto` pushes except for forks; `false` only builds          |
| `token`        | `github.token`            | Needs `packages: write`                                      |

## Outputs

| Output   | Meaning                        |
| -------- | ------------------------------ |
| `digest` | Digest of the pushed image     |
| `tags`   | Image references, one per line |

Every image gets OCI labels and annotations from the repository, a provenance attestation and an
SBOM. The run's summary lists the tags.
