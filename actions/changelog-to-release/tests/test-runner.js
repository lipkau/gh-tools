#!/usr/bin/env node

/**
 * Cross-platform test runner for changelog-to-release action
 * Works on Windows, macOS, and Linux without additional dependencies
 */

const {execSync} = require('child_process')
const fs = require('fs')
const path = require('path')

// Colors for cross-platform terminal output
const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
}

// Load test configuration
const configPath = path.join(__dirname, 'test-config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

const {changelog, successVersion, errorVersion} = config.testConfig

/**
 * Format GitHub Actions output for readability
 * @param {string} output - Raw output from the action
 * @returns {string} Formatted output
 */
function formatOutput(output) {
  return output
    .replace(/%0A/g, '\n')
    .replace(/::set-output name=title::/g, '📝 Title: ')
    .replace(/::set-output name=body::/g, '📄 Body:\n')
    .replace(/::error::/g, '🚨 Error: ')
}

/**
 * Print colored output
 * @param {string} text - Text to print
 * @param {string} color - Color name
 */
function printColored(text, color = 'reset') {
  let colorCode
  switch (color) {
    case 'blue':
      colorCode = colors.blue
      break
    case 'green':
      colorCode = colors.green
      break
    case 'red':
      colorCode = colors.red
      break
    case 'yellow':
      colorCode = colors.yellow
      break
    default:
      colorCode = colors.reset
      break
  }
  console.log(`${colorCode}${text}${colors.reset}`)
}

/**
 * Print test header
 */
function printHeader() {
  console.log()
  printColored('🧪 Testing Changelog-to-Release Action', 'blue')
  printColored('==================================', 'blue')
}

/**
 * Print test summary
 */
function printSummary() {
  console.log()
  printColored('🎉 All tests completed successfully!', 'green')
  printColored('==================================', 'green')
}

/**
 * Build the project quietly
 */
function buildQuiet() {
  try {
    execSync('npm run build', {stdio: 'pipe', cwd: path.join(__dirname, '..')})
  } catch (error) {
    console.error(
      'Build failed:',
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
}

/**
 * Run a test scenario
 * @param {string} versionName - Version to test
 * @param {string} scenario - Scenario description
 * @param {boolean} expectError - Whether to expect an error
 */
function runTest(versionName, scenario, expectError = false) {
  printColored(
    `${expectError ? '❌' : '✅'} Testing ${scenario} scenario (${versionName}):`,
    expectError ? 'red' : 'green'
  )
  printColored(
    '-----------------------------------',
    expectError ? 'red' : 'green'
  )

  try {
    const env = {
      ...process.env,
      'INPUT_VERSION-NAME': versionName,
      INPUT_CHANGELOG: changelog
    }

    const result = execSync('node dist/index.js', {
      env,
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe'
    })

    console.log(formatOutput(result))

    if (expectError) {
      console.error('Expected an error but test succeeded')
      process.exit(1)
    }
  } catch (error) {
    if (expectError) {
      // Extract error output from various possible properties
      const errorOutput = String(
        error?.stdout || error?.stderr || error?.message || error
      )
      console.log(formatOutput(errorOutput))
      printColored('✓ Error test passed - expected behavior', 'green')
    } else {
      const errorMessage = String(error?.message || error)
      console.error('Test failed unexpectedly:', errorMessage)
      process.exit(1)
    }
  }
}

/**
 * Run success test
 */
function testSuccess() {
  runTest(successVersion, 'SUCCESS', false)
}

/**
 * Run error test
 */
function testError() {
  runTest(errorVersion, 'ERROR', true)
}

/**
 * Run all tests
 */
function runAllTests() {
  printHeader()
  buildQuiet()
  testSuccess()
  console.log()
  testError()
  printSummary()
}

// Handle command line arguments
const command = process.argv[2] || 'full'

switch (command) {
  case 'success':
    buildQuiet()
    testSuccess()
    break
  case 'error':
    buildQuiet()
    testError()
    break
  case 'full':
  default:
    runAllTests()
    break
}
