# gh-tools

Shared GitHub Actions and the shared Renovate preset for lipkau's repositories. Each action lives in
`actions/<name>/` with its own `README.md` and `CHANGELOG.md`. Repositories pin these by commit SHA,
so a change here reaches them only through Renovate's pull requests.

## Validate

Run `npm run lint && npm run type-check && npm run build && npm test` before committing. CI also
fails when `npm run build` changes a committed `dist/`, so commit the rebuilt `dist/`.

## Actions

- TypeScript actions (`changelog-to-release`, `ghcr-cleanup`): sources in `src/`, bundled into
  `dist/` with ncc. Keep decisions in pure functions with tests; `ghcr-cleanup/src/plan.ts` is the
  pattern.
- Composite actions (`container-image`): only `action.yml`. Pin every `uses:` by commit SHA.
- A change that alters an action's behavior gets a `CHANGELOG.md` entry and a version bump in its
  `package.json` (TypeScript actions).

## Releasing

Pushing a tag `<action>/vX.Y.Z` on `main` runs `release.yml`: it creates the release from the
action's changelog and moves the shared `v1` tag. Pushing a tag publishes, so ask first.

## Renovate preset

`renovate/default.json` is read by every repository's Renovate. Validate a change with
`npx --package renovate -- renovate-config-validator renovate/default.json`.
