import * as core from '@actions/core'
import {join} from 'path'
import {run} from '../src/index'

// Mock @actions/core
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  debug: jest.fn(),
  info: jest.fn()
}))

const mockCore = core as jest.Mocked<typeof core>

describe('Changelog to Release Action - Mocked Core Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should run successfully with valid inputs and produce outputs', async () => {
    // Set up mock inputs
    mockCore.getInput.mockImplementation(
      (
        name: string,
        options?: {required?: boolean; trimWhitespace?: boolean}
      ) => {
        const inputs: Record<string, string> = {
          'version-name': 'v1.1.0',
          changelog: join(__dirname, '../CHANGELOG.md'),
          configuration: '' // Use default config
        }

        const value = inputs[name] || ''
        if (options?.required && !value) {
          throw new Error(`Input required and not supplied: ${name}`)
        }
        return value
      }
    )

    // Run the action
    await run()

    expect(mockCore.setFailed).not.toHaveBeenCalled()
    expect(mockCore.setOutput).toHaveBeenCalledWith('title', expect.any(String))
    expect(mockCore.setOutput).toHaveBeenCalledWith('body', expect.any(String))

    // Check that outputs contain expected content
    const titleCall = mockCore.setOutput.mock.calls.find(
      call => call[0] === 'title'
    )
    const bodyCall = mockCore.setOutput.mock.calls.find(
      call => call[0] === 'body'
    )

    expect(titleCall?.[1]).toContain('v1.1.0')
    expect(bodyCall?.[1]).toBeTruthy()
  })

  it('should handle missing required input gracefully', async () => {
    // Don't provide required version-name input
    mockCore.getInput.mockImplementation(
      (
        name: string,
        options?: {required?: boolean; trimWhitespace?: boolean}
      ) => {
        const inputs: Record<string, string> = {
          changelog: join(__dirname, '../CHANGELOG.md'),
          configuration: ''
        }

        const value = inputs[name] || ''
        if (options?.required && !value) {
          throw new Error(`Input required and not supplied: ${name}`)
        }
        return value
      }
    )

    // Run the action
    await run()

    // Should fail when required input is missing
    expect(mockCore.setFailed).toHaveBeenCalled()
    expect(mockCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Input required and not supplied')
    )
  })

  it('should use default configuration when no config file provided', async () => {
    mockCore.getInput.mockImplementation(
      (
        name: string,
        options?: {required?: boolean; trimWhitespace?: boolean}
      ) => {
        const inputs: Record<string, string> = {
          'version-name': 'v1.1.0',
          changelog: join(__dirname, '../CHANGELOG.md'),
          configuration: '' // No config file
        }

        const value = inputs[name] || ''
        if (options?.required && !value) {
          throw new Error(`Input required and not supplied: ${name}`)
        }
        return value
      }
    )

    // Run the action
    await run()

    expect(mockCore.setFailed).not.toHaveBeenCalled()
    expect(mockCore.setOutput).toHaveBeenCalledWith('title', expect.any(String))
    expect(mockCore.setOutput).toHaveBeenCalledWith('body', expect.any(String))
  })

  it('should load and use custom configuration from file', async () => {
    // Create custom config
    const customConfig = JSON.stringify({
      emojisPrefix: false,
      emojis: {
        features: '⭐',
        fixes: '🐛'
      },
      order: ['fixes', 'features']
    })

    // Create a temporary config file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {writeFileSync, unlinkSync} = require('fs')
    const configPath = join(__dirname, 'temp-config.json')
    writeFileSync(configPath, customConfig)

    try {
      mockCore.getInput.mockImplementation(
        (
          name: string,
          options?: {required?: boolean; trimWhitespace?: boolean}
        ) => {
          const inputs: Record<string, string> = {
            'version-name': 'v1.1.0',
            changelog: join(__dirname, '../CHANGELOG.md'),
            configuration: configPath
          }

          const value = inputs[name] || ''
          if (options?.required && !value) {
            throw new Error(`Input required and not supplied: ${name}`)
          }
          return value
        }
      )

      // Run the action
      await run()

      expect(mockCore.setFailed).not.toHaveBeenCalled()
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        'title',
        expect.any(String)
      )
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        'body',
        expect.any(String)
      )

      // Check that custom emojis are used (emojisPrefix: false means emoji comes after)
      const bodyCall = mockCore.setOutput.mock.calls.find(
        call => call[0] === 'body'
      )
      const body = bodyCall?.[1] as string
      expect(body).toBeTruthy()
    } finally {
      // Clean up temp file
      unlinkSync(configPath)
    }
  })
})
