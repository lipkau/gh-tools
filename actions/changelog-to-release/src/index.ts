import * as core from '@actions/core'
import {readFileSync} from 'fs'
import {basename} from 'path'

interface Configuration {
  emojisPrefix?: boolean
  emojis?: Record<string, string>
  order?: string[]
}

interface Version {
  title: string
  body: string
}

interface VersionCollection {
  [version: string]: Version
}

interface ParsedSections {
  unlabelled: string
  sections: Array<[string, string]>
}

const defaultConfiguration: Required<Configuration> = {
  emojisPrefix: true,
  emojis: {
    changes: '⚙️',
    dependencies: '📦',
    distribution: '🚚',
    features: '🚀',
    'new features': '🚀',
    fixes: '🔧',
    links: '🔗',
    notes: '📝',
    other: '💬',
    security: '🛡'
  },
  order: [
    'new features',
    'features',
    'changes',
    'fixes',
    'security',
    'dependencies',
    'distribution',
    'notes',
    'other',
    'links'
  ]
}

function findVersions(changelog: string): VersionCollection {
  const versions: VersionCollection = {}
  let remainingChangelog = changelog
  let nextHeader = remainingChangelog.search(/^## /m)

  while (nextHeader >= 0) {
    remainingChangelog = remainingChangelog.substr(nextHeader)
    const versionMatch = remainingChangelog.match(/^## ([^ \n]*)[^\n]*$/m)
    const titleMatch = remainingChangelog.match(/^## ([^\n]*)$/m)

    if (!versionMatch?.[1] || !titleMatch?.[1]) {
      break
    }

    const version = versionMatch[1].trim()
    const title = titleMatch[1].trim()

    remainingChangelog = remainingChangelog.substr(
      remainingChangelog.search(/\n/)
    )
    nextHeader = remainingChangelog.search(/^## /m)
    const endPosition = nextHeader >= 0 ? nextHeader : remainingChangelog.length

    versions[version] = {
      title,
      body: remainingChangelog.substring(0, endPosition - 1).trim()
    }

    remainingChangelog = remainingChangelog.substr(endPosition)
    nextHeader = remainingChangelog.search(/^## /m)
  }

  return versions
}

function findSections(changelog: string): ParsedSections {
  const sections: Array<[string, string]> = []
  let remainingChangelog = changelog
  let nextHeader = remainingChangelog.search(/^#/m)
  const unlabelled = remainingChangelog.substring(
    0,
    nextHeader >= 0 ? nextHeader : remainingChangelog.length
  )

  while (nextHeader >= 0) {
    remainingChangelog = remainingChangelog.substr(nextHeader)
    const titleMatch = remainingChangelog.match(/^### ([^\n]*)$/m)

    if (!titleMatch?.[1]) {
      break
    }

    const title = titleMatch[1].trim()
    remainingChangelog = remainingChangelog.substr(
      remainingChangelog.search(/\n/)
    )
    nextHeader = remainingChangelog.search(/^### /m)
    const endPosition = nextHeader >= 0 ? nextHeader : remainingChangelog.length

    sections.push([title, remainingChangelog.substring(0, endPosition).trim()])
    remainingChangelog = remainingChangelog.substr(endPosition)
    nextHeader = remainingChangelog.search(/^### /m)
  }

  return {unlabelled, sections}
}

function orderSections(
  sections: Array<[string, string]>,
  sectionsOrder: string[]
): Array<[string, string]> {
  const sectionsOrdered: Array<[string, string]> = []

  // Add ordered sections first
  sections
    .filter(([title]) => sectionsOrder.includes(title.toLowerCase()))
    .sort(([a], [b]) => {
      const aIndex = sectionsOrder.indexOf(a.toLowerCase())
      const bIndex = sectionsOrder.indexOf(b.toLowerCase())
      return aIndex === bIndex ? 0 : aIndex > bIndex ? 1 : -1
    })
    .forEach(([title, body]) => sectionsOrdered.push([title, body]))

  // Add remaining sections alphabetically
  sections
    .filter(([title]) => !sectionsOrder.includes(title.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([title, body]) => sectionsOrdered.push([title, body]))

  return sectionsOrdered
}

function emojiSections(
  sections: Array<[string, string]>,
  sectionsEmojis: Record<string, string>,
  prefix: boolean
): Array<[string, string]> {
  return sections.map(([title, body]) => {
    const emoji = sectionsEmojis[title.toLowerCase()] || ''
    const newTitle = prefix
      ? `${emoji} ${title}`.trim()
      : `${title} ${emoji}`.trim()
    return [newTitle, body]
  })
}

function buildRelease(sections: ParsedSections): string {
  let release = sections.unlabelled ? `${sections.unlabelled.trim()}\n\n` : ''

  sections.sections.forEach(([title, body]) => {
    release += `## ${title}\n\n${body.replace(/^#/gm, '')}\n\n`
  })

  return release.trim()
}

async function run(): Promise<void> {
  try {
    const versionName = core.getInput('version-name', {required: true})
    const changelogPath = core.getInput('changelog') || 'CHANGELOG.md'
    const configurationPath = core.getInput('configuration') || null

    core.info(`VERSION: ${versionName}`)
    core.info(`CHANGELOG: ${changelogPath}`)
    core.info(`CONFIGURATION: ${configurationPath || '{default}'}`)

    const changelog =
      readFileSync(changelogPath, {encoding: 'utf-8'}).trim() + '\n'

    let configuration: Required<Configuration>
    if (configurationPath) {
      const configData = JSON.parse(
        readFileSync(configurationPath, {encoding: 'utf-8'})
      )
      configuration = {
        ...defaultConfiguration,
        ...configData,
        emojisPrefix:
          configData.emojisPrefix ?? defaultConfiguration.emojisPrefix
      }
    } else {
      configuration = defaultConfiguration
    }

    const versions = findVersions(changelog)
    const version = versions[versionName]

    const versionKeys = Object.keys(versions)
    core.info(
      `VERSIONS: ${versionKeys.slice(0, 5).join(', ')}${
        versionKeys.length > 5 ? `, ... [${versionKeys.length - 5} more]` : ''
      }`
    )

    if (!version) {
      throw new Error(
        `Version '${versionName}' not found in ${basename(changelogPath)}`
      )
    }

    const sections = findSections(version.body)
    sections.sections = orderSections(sections.sections, configuration.order)
    sections.sections = emojiSections(
      sections.sections,
      configuration.emojis,
      configuration.emojisPrefix
    )

    core.setOutput('title', version.title)
    core.setOutput('body', buildRelease(sections))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    core.setFailed(errorMessage)
  }
}

if (require.main === module) {
  run()
}

// Export functions for testing
export {
  findVersions,
  findSections,
  orderSections,
  emojiSections,
  buildRelease,
  defaultConfiguration,
  run
}
