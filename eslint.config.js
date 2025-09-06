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
