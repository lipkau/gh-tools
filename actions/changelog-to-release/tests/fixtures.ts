// Test fixtures and sample data
export const sampleChangelog = `# Changelog

## v1.1.0

### Features

* Added TypeScript support
* Improved error handling

### Fixes

* Fixed parsing issues

## v1.0.0 - First Release

First release of the action.

### Features

* Parse CHANGELOG.md to create release body
* Add emojis to the title sections
* Sort sections
`

export const sampleConfiguration = {
  emojisPrefix: true,
  emojis: {
    features: '🚀',
    fixes: '🔧',
    changes: '⚙️'
  },
  order: ['features', 'fixes', 'changes']
}

export const expectedVersions = {
  'v1.1.0': {
    title: 'v1.1.0',
    body: `### Features

* Added TypeScript support
* Improved error handling

### Fixes

* Fixed parsing issues`
  },
  'v1.0.0': {
    title: 'v1.0.0 - First Release',
    body: `First release of the action.

### Features

* Parse CHANGELOG.md to create release body
* Add emojis to the title sections
* Sort sections`
  }
}
