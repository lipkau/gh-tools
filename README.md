# GitHub Tools

A curated collection of custom GitHub Actions designed to streamline common CI/CD workflows and
automation tasks.

> [!NOTE]
> This collection is primarily created for my personal workflow needs.
> While the actions are open source and you're welcome to use them,
> this is not a community project actively seeking feature requests or accommodating diverse use cases.
> Feel free to fork if you need modifications!

## 🚀 Available Actions

### [**Changelog to Release**](actions/changelog-to-release/)

Transform `CHANGELOG.md` entries into beautifully formatted GitHub releases with emoji support
and intelligent section sorting.

### [**Container Image**](actions/container-image/)

Build a repository's container image and push it to GHCR, with the same tags in every repository:
branch and commit on every build, semver on releases, and `latest` on the newest release.

### [**GHCR Cleanup**](actions/ghcr-cleanup/)

Delete a repository's stale container images from GHCR: closed PRs' images, superseded builds and
old default-branch builds, without breaking multi-platform images.

## 🔧 Renovate preset

[`renovate/default.json`](renovate/default.json) holds the Renovate settings shared by lipkau's
repositories, including a 3-day wait before proposing a release. Extend it from a repository's
`renovate.json`:

```json
{ "extends": ["github>lipkau/gh-tools//renovate/default"] }
```

## 📖 Quick Start

Each action is self-contained and can be used independently. Simply reference the action in your workflow:

```yaml
uses: lipkau/gh-tools/actions/{action-name}@v1
```

For detailed usage instructions, configuration options, and examples,
see the individual action documentation linked above.

## Development

This repository uses npm workspaces to manage multiple GitHub Actions.

### Building and Testing

```bash
# Install dependencies
npm install

# Build all actions
npm run build

# Run tests for all actions
npm test

# Format code
npm run format

# Lint documentation
npm run lint
```

### Adding New Actions

When adding new actions to this repository:

1. Create a new directory under `actions/`
2. Add the action to the workspace configuration in the root `package.json`
3. Use TypeScript for consistency
4. Follow the testing patterns established in existing actions
5. Update documentation

### Testing

The repository uses Jest with a shared configuration at the root level.
Each action can have its own test files in a `tests/` directory.
The Jest configuration automatically detects and runs tests for all actions.

## Contributing

This is a personal tools repository, but feel free to open issues or suggest improvements.

## 🤝 Contributing

Contributions are welcome! Whether you want to:

- 🐛 Report a bug
- 🔧 Improve existing actions
- 📝 Enhance documentation

Please feel free to open an issue or submit a pull request.

### Adding a New Action

1. Create a new directory under `actions/`
2. Follow the existing structure and conventions
3. Include comprehensive documentation
4. Add appropriate tests
5. Update this README to include your action

---

**Made with ❤️ by [lipkau](https://github.com/lipkau)**
