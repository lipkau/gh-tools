import {
  findVersions,
  findSections,
  orderSections,
  emojiSections,
  buildRelease,
  defaultConfiguration
} from '../src/index'

describe('Changelog to Release Action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('findVersions', () => {
    it('should find version sections in changelog', () => {
      const content = `# Changelog

## [1.1.0] - 2023-01-15
### Features
- New feature

## [1.0.0] - 2023-01-01
### Features
- Initial release`

      const versions = findVersions(content)
      expect(Object.keys(versions)).toHaveLength(2)
      expect(versions['[1.1.0]']).toBeDefined()
      expect(versions['[1.0.0]']).toBeDefined()
      expect(versions['[1.1.0]']?.title).toBe('[1.1.0] - 2023-01-15')
    })

    it('should handle different version formats', () => {
      const content = `# Changelog

## v1.1.0
### Features
- New feature

## Version 1.0.0
### Features
- Initial release`

      const versions = findVersions(content)
      expect(Object.keys(versions)).toHaveLength(2)
      expect(versions['v1.1.0']).toBeDefined()
      expect(versions['Version']).toBeDefined()
    })

    it('should extract multiple versions from changelog', () => {
      const changelog = `# Changelog

## 2.0.0 - 2023-02-01
Version 2.0.0 description
### Features
- New feature

## 1.0.0 - 2023-01-01
Version 1.0.0 description
### Fixes
- Fix item`

      const result = findVersions(changelog)
      expect(Object.keys(result)).toHaveLength(2)
      expect(Object.keys(result)).toContain('2.0.0')
      expect(Object.keys(result)).toContain('1.0.0')
      expect(result['2.0.0']?.body).toContain('New feature')
      expect(result['1.0.0']?.body).toContain('Fixes')
    })

    it('should handle empty changelog', () => {
      const changelog = ''
      const result = findVersions(changelog)
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('findSections', () => {
    it('should extract sections from version content', () => {
      const versionContent = `### Features
- Add new feature A
- Implement feature B

### Fixes
- Fix bug in component X`

      const sections = findSections(versionContent)
      expect(sections.sections).toHaveLength(2)
      expect(sections.sections[0]?.[0]).toBe('Features')
      expect(sections.sections[1]?.[0]).toBe('Fixes')
      expect(sections.sections[0]?.[1]).toContain('Add new feature A')
    })

    it('should handle content without sections', () => {
      const versionContent = `Just some release notes without sections.`
      const sections = findSections(versionContent)
      expect(sections.unlabelled.trim()).toBe(
        'Just some release notes without sections.'
      )
      expect(sections.sections).toHaveLength(0)
    })
  })

  describe('orderSections', () => {
    it('should order sections according to configuration', () => {
      const sections: Array<[string, string]> = [
        ['Fixes', '- Fix something'],
        ['Features', '- New feature'],
        ['Documentation', '- Update docs']
      ]

      const order = ['features', 'fixes', 'documentation']

      const ordered = orderSections(sections, order)
      expect(ordered[0]?.[0]).toBe('Features')
      expect(ordered[1]?.[0]).toBe('Fixes')
      expect(ordered[2]?.[0]).toBe('Documentation')
    })

    it('should place unordered sections after ordered ones', () => {
      const sections: Array<[string, string]> = [
        ['Other', '- Other stuff'],
        ['Features', '- New feature'],
        ['Fixes', '- Bug fix']
      ]

      const order = ['features', 'fixes']

      const ordered = orderSections(sections, order)
      expect(ordered[0]?.[0]).toBe('Features')
      expect(ordered[1]?.[0]).toBe('Fixes')
      expect(ordered[2]?.[0]).toBe('Other')
    })

    it('should handle case-insensitive section names', () => {
      const sections: Array<[string, string]> = [
        ['FEATURES', '- Feature content'],
        ['notes', '- Note content']
      ]
      const sectionsOrder = ['features', 'notes']

      const result = orderSections(sections, sectionsOrder)
      expect(result[0]?.[0]).toBe('FEATURES')
      expect(result[1]?.[0]).toBe('notes')
    })
  })

  describe('emojiSections', () => {
    it('should add emojis to sections with prefix', () => {
      const sections: Array<[string, string]> = [
        ['Features', '- New feature'],
        ['Fixes', '- Bug fix']
      ]

      const emojis = {
        features: '🚀',
        fixes: '🔧'
      }

      const withEmojis = emojiSections(sections, emojis, true)
      expect(withEmojis[0]?.[0]).toBe('🚀 Features')
      expect(withEmojis[1]?.[0]).toBe('🔧 Fixes')
    })

    it('should add emojis to sections as suffix', () => {
      const sections: Array<[string, string]> = [['Features', '- New feature']]

      const emojis = {
        features: '🚀'
      }

      const withEmojis = emojiSections(sections, emojis, false)
      expect(withEmojis[0]?.[0]).toBe('Features 🚀')
    })

    it('should not modify sections without emoji config', () => {
      const sections: Array<[string, string]> = [['Features', '- New feature']]
      const emojis = {}

      const withEmojis = emojiSections(sections, emojis, true)
      expect(withEmojis[0]?.[0]).toBe('Features')
    })
  })

  describe('buildRelease', () => {
    it('should build release notes from sections', () => {
      const sections = {
        unlabelled: 'Release notes introduction',
        sections: [
          ['🚀 Features', '- New feature A\n- New feature B'],
          ['🔧 Fixes', '- Bug fix X\n- Bug fix Y']
        ] as Array<[string, string]>
      }

      const release = buildRelease(sections)
      expect(release).toContain('Release notes introduction')
      expect(release).toContain('## 🚀 Features')
      expect(release).toContain('## 🔧 Fixes')
      expect(release).toContain('New feature A')
      expect(release).toContain('Bug fix X')
    })

    it('should handle sections without unlabelled content', () => {
      const sections = {
        unlabelled: '',
        sections: [['🚀 Features', '- New feature']] as Array<[string, string]>
      }

      const release = buildRelease(sections)
      expect(release).toBe('## 🚀 Features\n\n- New feature')
    })

    it('should handle empty sections', () => {
      const sections = {
        unlabelled: '',
        sections: [] as Array<[string, string]>
      }

      const release = buildRelease(sections)
      expect(release).toBe('')
    })
  })

  describe('defaultConfiguration', () => {
    it('should have expected default values', () => {
      expect(defaultConfiguration.emojisPrefix).toBe(true)
      expect(defaultConfiguration.emojis['features']).toBe('🚀')
      expect(defaultConfiguration.emojis['fixes']).toBe('🔧')
      expect(defaultConfiguration.order).toContain('features')
      expect(defaultConfiguration.order).toContain('fixes')
    })
  })

  describe('End-to-End Processing', () => {
    it('should process a complete changelog correctly', () => {
      const changelog = `# Changelog

## 1.0.0 - 2023-01-01
Initial release
### Features
- Feature 1
- Feature 2
### Fixes
- Bug fix 1
### Notes
- Note 1`

      const versions = findVersions(changelog)
      expect(Object.keys(versions)).toContain('1.0.0')

      const {unlabelled, sections} = findSections(versions['1.0.0']?.body || '')
      expect(unlabelled.trim()).toBe('Initial release')
      expect(sections).toHaveLength(3)

      const orderedSections = orderSections(sections, [
        'features',
        'fixes',
        'notes'
      ])
      expect(orderedSections[0]?.[0]).toBe('Features')
      expect(orderedSections[1]?.[0]).toBe('Fixes')
      expect(orderedSections[2]?.[0]).toBe('Notes')
    })
  })
})
