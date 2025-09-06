# GitHub Copilot Instructions for gh-tools

## Project Overview

This is a Node.js/TypeScript project containing GitHub Actions utilities. The project is fully
TypeScript-based with comprehensive linting and formatting tools to maintain code quality.

## Project Structure

```
gh-tools/
├── LICENSE
├── package.json              # Main project configuration with linting scripts
├── README.md
├── tsconfig.json            # Root TypeScript configuration (type-checking only)
├── eslint.config.js         # ESLint flat config for TypeScript
├── .markdownlint.json       # Custom markdown linting rules
├── .markdownlintignore      # Markdown linting ignore patterns
└── actions/
    └── changelog-to-release/
        ├── action.yml
        ├── CHANGELOG.md
        ├── tsconfig.json    # Action-specific TypeScript config (builds to lib/)
        ├── package.json
        ├── README.md
        ├── src/
        │   └── index.ts     # TypeScript source code
        ├── tests/
        │   ├── fixtures/
        │   │   └── CHANGELOG.test.md  # Test data
        │   ├── test-config.json       # Test configuration
        │   └── test-runner.js         # Cross-platform Node.js test runner
        └── dist/            # Bundled distribution files
            └── index.js
```

## Development Environment

### Technology Stack

- **Runtime**: Node.js with full TypeScript support
- **Testing**: Cross-platform Node.js test runner with environment variable testing
- **Linting**: ESLint (flat config) + Prettier + markdownlint
- **Build**: TypeScript compiler + @vercel/ncc for bundling
- **Package Manager**: npm

### Key Dependencies

```json
{
  "devDependencies": {
    "@eslint/js": "^9.35.0",
    "@tsconfig/node24": "^24.0.1",
    "@tsconfig/strictest": "^2.0.5",
    "@types/node": "^24.3.1",
    "@vercel/ncc": "^0.38.3",
    "eslint": "^9.35.0",
    "markdownlint-cli": "^0.45.0",
    "prettier": "^3.6.2",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.42.0"
  }
}
```

## Linting and Formatting System

### Available Commands

- `npm run lint` - Run all linters (check only, no fixes)
- `npm run format` - Run all formatters with auto-fix
- `npm run type-check` - TypeScript type checking across the project
- `npm run _eslint` - ESLint only (TypeScript files)
- `npm run _prettier` - Prettier only (code formatting)
- `npm run _markdownlint` - markdownlint only (Markdown files)

### ESLint Configuration (eslint.config.js - Flat Config)

```javascript
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['actions/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    rules: {
      // Add any custom rules here
    }
  },
  {
    ignores: ['**/dist/', '**/lib/', '**/node_modules/', '**/*.js']
  }
]
```

### TypeScript Configuration

#### Root tsconfig.json (Type-checking only)

```json
{
  "extends": [
    "@tsconfig/node24/tsconfig.json",
    "@tsconfig/strictest/tsconfig.json"
  ],
  "compilerOptions": {
    "noEmit": true
  },
  "exclude": ["node_modules", "**/node_modules", "**/lib", "**/dist"]
}
```

#### Action-specific tsconfig.json (Compilation)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./lib",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "dist", "tests", "**/*.test.ts", "**/*.js"]
}
```

## Testing Strategy

### Cross-Platform Testing Architecture

The project uses a **simplified testing approach** optimized for the scope of the GitHub Actions:

- **Cross-platform Node.js test runner**: Works on Windows, macOS, and Linux without additional dependencies
- **Environment variable testing**: Tests actions with real GitHub Actions environment variables
- **Configuration-driven**: Test parameters defined in JSON configuration files
- **No external testing frameworks**: Uses only Node.js built-in modules for maximum compatibility

### Testing Structure

```
tests/
├── fixtures/
│   └── CHANGELOG.test.md      # Test data for changelog parsing
├── test-config.json           # Test configuration (versions, paths, etc.)
└── test-runner.js             # Cross-platform Node.js test runner
```

### Available Test Commands

- `npm test` - Run complete test suite (build + success + error scenarios)
- `npm run test:success` - Test success scenario only
- `npm run test:error` - Test error scenario only

### Test Configuration (test-config.json)

```json
{
  "testConfig": {
    "changelog": "tests/fixtures/CHANGELOG.test.md",
    "successVersion": "v1.0.0",
    "errorVersion": "v99.99.99"
  },
  "outputFormatting": {
    "colors": true,
    "emojis": true
  }
}
```

### Test Runner Features

- **Real Action Testing**: Executes the actual built action with environment variables
- **Beautiful Output**: Formats GitHub Actions output for readability with colors and emojis
- **Error Handling**: Tests both success and failure scenarios
- **Cross-platform**: Works identically on Windows, macOS, and Linux

### Markdown Linting Configuration (.markdownlint.json)

```json
{
  "MD013": {
    "line_length": 100
  },
  "MD041": false
}
```

### Important Implementation Notes

#### Cross-Platform Testing Approach

- **Issue**: Previous bash-based testing required WSL or devcontainer on Windows
- **Solution**: Node.js-based test runner works natively on all platforms
- **Benefits**: Zero additional dependencies, consistent behavior across Windows/macOS/Linux
- **Architecture**: Uses Node.js built-in modules only, reads JSON config natively

#### Testing Strategy Evolution

- **Previous**: Complex Jest framework with mocked dependencies
- **Current**: Simple environment variable testing with real action execution
- **Rationale**: For simple GitHub actions, real execution testing provides better coverage than mocked unit tests
- **Implementation**: Direct action testing with actual GitHub Actions environment variables

#### markdownlint Ignore Patterns

- **Issue**: markdownlint was processing thousands of files in `node_modules` despite ignore configuration
- **Solution**: Use `--ignore node_modules` flag directly in npm script rather than `.markdownlintignore` file
- **Working Script**: `"_markdownlint": "markdownlint '**/*.md' --ignore node_modules"`

#### Prettier Integration

- Uses `.gitignore` patterns automatically via `--ignore-unknown` flag
- Processes all file types Prettier supports
- Auto-fixes formatting issues when using `npm run format`

#### ESLint TypeScript Support

- Configured with ESLint flat config and `typescript-eslint`
- Uses recommended rules from both ESLint and TypeScript-ESLint
- **Important**: Only processes `.ts` files, ignores `.js` files to prevent conflicts
- Configured to ignore compiled output directories (`lib/`, `dist/`)

#### TypeScript Compilation Strategy

- **Root tsconfig.json**: Type-checking only (`noEmit: true`)
- **Action-specific tsconfigs**: Actual compilation to `dist/` directory via @vercel/ncc bundling
- **Source structure**: All source code in `src/` directories
- **Test files**: Excluded from compilation but included in type-checking

## Development Workflow

### Before Committing

1. Run `npm run type-check` to ensure TypeScript compiles correctly
2. Run `npm test` to ensure all tests pass
3. Run `npm run lint` to check for linting issues
4. Run `npm run format` to auto-fix formatting issues
5. Address any remaining linting errors manually

### Adding New Files

- **TypeScript files**: Place in `src/` directories, will be automatically linted and type-checked
- **Test files**: Place test data in `tests/fixtures/` and update `test-config.json` as needed
- **Markdown files**: Will be automatically linted by markdownlint
- **All files**: Will be automatically formatted by Prettier

### Modifying Linting Rules

- **ESLint**: Edit `eslint.config.js` (flat config format)
- **TypeScript**: Edit `tsconfig.json` files
- **markdownlint**: Edit `.markdownlint.json`
- **Prettier**: Uses default configuration with .gitignore integration

## Troubleshooting

### Common Issues

#### TypeScript Compilation Conflicts

**Symptoms**: `Cannot write file because it would overwrite input file` errors
**Cause**: JavaScript files exist in same location as TypeScript output
**Solution**: Remove conflicting `.js` files, ensure proper `exclude` patterns in tsconfig
**Prevention**: Keep source (`.ts`) and output (`.js`) in separate directories (src/ vs dist/)

#### ESLint Not Finding TypeScript Files

**Symptoms**: ESLint skipping .ts files or processing .js files incorrectly
**Solution**: Verify flat config format in `eslint.config.js` and proper `files`/`ignores` patterns

#### markdownlint Processing Too Many Files

**Symptoms**: Thousands of linting errors from node_modules or other directories
**Solution**: Ensure the npm script uses `--ignore node_modules` flag
**Correct Script**: `"_markdownlint": "markdownlint '**/*.md' --ignore node_modules"`

### Testing the Linting Setup

```bash
# Test TypeScript compilation and type checking
npm run type-check   # Should show no TypeScript errors

# Test individual linters
npm run _eslint
npm run _prettier
npm run _markdownlint

# Test complete workflow
npm run lint     # Should show no errors
npm run format   # Should auto-fix any formatting issues
npm test         # Should pass all tests
```

## File Patterns and Exclusions

### What Gets Linted

- **ESLint**: `actions/**/*.ts` files only
- **TypeScript**: All `.ts` files for type-checking
- **Prettier**: All supported file types (respects .gitignore)
- **markdownlint**: `**/*.md` files (excludes node_modules)

### What Gets Ignored

- `node_modules/` directory (all tools)
- `dist/` directories (compiled output)
- `.js` files (to prevent conflicts with TypeScript)
- Files matching `.gitignore` patterns (Prettier)

## Future Maintenance

### Adding New Linting Rules

1. For TypeScript: Add rules to `eslint.config.js`
2. For Markdown: Add rules to `.markdownlint.json`
3. For TypeScript compiler: Modify `tsconfig.json` files
4. Test changes with `npm run lint` and `npm run type-check` before committing

### Updating Dependencies

- ESLint and TypeScript-ESLint should be updated together
- Update `@tsconfig/*` packages when changing TypeScript targets
- Test linting and compilation after dependency updates
- Ensure all tests still pass after updates

### Adding New File Types

- Most file types are handled automatically by Prettier
- For specialized linting, add new npm scripts following the `_toolname` pattern
- Update the main `lint` and `format` scripts to include new tools

## Best Practices

1. **Always run type-check and tests**: `npm run type-check && npm test`
2. **Use format command for auto-fixes**: `npm run format`
3. **Check individual tools when debugging**: Use `_eslint`, `_prettier`, `_markdownlint` scripts
4. **Keep source and output separate**: TypeScript source in `src/`, compiled output in `dist/`
5. **Clean up conflicts immediately**: Remove `.js` files when converting to TypeScript
6. **Maintain consistency**: Follow the established directory and naming patterns
