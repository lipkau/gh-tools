import * as core from '@actions/core'
import {
  type Facts,
  type Kind,
  type PackageVersion,
  type PullRequest,
  plan,
  type Settings,
  type Verdict
} from './plan'

const MANIFEST_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json'
].join(', ')

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** The few GitHub REST calls this action needs, on Node's own fetch. */
class GitHub {
  readonly #base = process.env['GITHUB_API_URL'] ?? 'https://api.github.com'
  readonly #token: string

  constructor(token: string) {
    this.#token = token
  }

  async #request(method: string, url: string): Promise<Response> {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.#token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (!response.ok) {
      const body = await response.text()
      throw new HttpError(
        response.status,
        `${method} ${url}: HTTP ${response.status} ${body.slice(0, 200)}`
      )
    }
    return response
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.#request('GET', `${this.#base}${path}`)
    return (await response.json()) as T
  }

  /** Follows the `Link: rel="next"` header through every page. */
  async getAll<T>(path: string): Promise<T[]> {
    const items: T[] = []
    const separator = path.includes('?') ? '&' : '?'
    let url: string | undefined = `${this.#base}${path}${separator}per_page=100`
    while (url !== undefined) {
      const response = await this.#request('GET', url)
      items.push(...((await response.json()) as T[]))
      url = /<([^>]+)>;\s*rel="next"/.exec(
        response.headers.get('link') ?? ''
      )?.[1]
    }
    return items
  }

  async delete(path: string): Promise<void> {
    await this.#request('DELETE', `${this.#base}${path}`)
  }
}

interface Target {
  owner: string
  repo: string
  packageName: string
  /** `/users/<owner>` or `/orgs/<owner>`, the package API's prefix. */
  packagesPath: string
}

function wholeNumber(name: string): number {
  const value = Number(core.getInput(name, {required: true}))
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a whole number, not "${value}"`)
  }
  return value
}

async function listVersions(
  api: GitHub,
  target: Target
): Promise<PackageVersion[]> {
  const versions = await api.getAll<{
    id: number
    name: string
    created_at: string
    metadata?: {container?: {tags?: string[]}}
  }>(
    `${target.packagesPath}/packages/container/` +
      `${encodeURIComponent(target.packageName)}/versions`
  )
  return versions.map(v => ({
    id: v.id,
    digest: v.name,
    created: v.created_at,
    tags: v.metadata?.container?.tags ?? []
  }))
}

async function listPulls(api: GitHub, target: Target): Promise<PullRequest[]> {
  const pulls = await api.getAll<{
    number: number
    state: string
    head: {ref: string; sha: string}
  }>(`/repos/${target.owner}/${target.repo}/pulls?state=all`)
  return pulls.map(p => ({
    number: p.number,
    open: p.state === 'open',
    headRef: p.head.ref,
    headSha: p.head.sha
  }))
}

async function onDefaultBranch(
  api: GitHub,
  target: Target,
  defaultBranch: string,
  versions: PackageVersion[]
): Promise<Map<string, boolean>> {
  const shas = new Set(
    versions.flatMap(v =>
      v.tags.flatMap(t => /^sha-([0-9a-f]{7,40})$/.exec(t)?.[1] ?? [])
    )
  )
  const result = new Map<string, boolean>()
  for (const sha of shas) {
    const basehead = `${encodeURIComponent(defaultBranch)}...${sha}`
    try {
      const {status} = await api.get<{status: string}>(
        `/repos/${target.owner}/${target.repo}/compare/${basehead}?per_page=1`
      )
      result.set(sha, status === 'identical' || status === 'behind')
    } catch (error) {
      // 404: the commit is gone, for example force-pushed away.
      if (error instanceof HttpError && error.status === 404) {
        result.set(sha, false)
      } else {
        core.warning(`Could not look up commit ${sha}: ${String(error)}`)
      }
    }
  }
  return result
}

async function registryToken(target: Target, token: string): Promise<string> {
  const scope = `repository:${target.owner}/${target.packageName}:pull`
  const url = `https://ghcr.io/token?service=ghcr.io&scope=${scope.toLowerCase()}`
  const basic = Buffer.from(`${target.owner}:${token}`).toString('base64')
  const response = await fetch(url, {
    headers: {Authorization: `Basic ${basic}`}
  })
  if (!response.ok) {
    throw new Error(`ghcr.io token request failed: HTTP ${response.status}`)
  }
  const body = (await response.json()) as {token?: string}
  if (!body.token) {
    throw new Error('ghcr.io token response had no token')
  }
  return body.token
}

async function readChildren(
  target: Target,
  bearer: string,
  versions: PackageVersion[]
): Promise<Map<string, string[]>> {
  const image = `${target.owner}/${target.packageName}`.toLowerCase()
  const children = new Map<string, string[]>()
  const queue = [...versions]
  const worker = async (): Promise<void> => {
    for (let v = queue.pop(); v !== undefined; v = queue.pop()) {
      const url = `https://ghcr.io/v2/${image}/manifests/${v.digest}`
      try {
        const response = await fetch(url, {
          headers: {Authorization: `Bearer ${bearer}`, Accept: MANIFEST_TYPES}
        })
        if (!response.ok) {
          core.warning(`Manifest ${v.digest}: HTTP ${response.status}`)
          continue
        }
        const manifest = (await response.json()) as {
          manifests?: {digest: string}[]
        }
        children.set(
          v.digest,
          (manifest.manifests ?? []).map(m => m.digest)
        )
      } catch (error) {
        core.warning(`Manifest ${v.digest}: ${String(error)}`)
      }
    }
  }
  await Promise.all(Array.from({length: 8}, worker))
  return children
}

async function remove(
  api: GitHub,
  target: Target,
  version: PackageVersion
): Promise<void> {
  try {
    await api.delete(
      `${target.packagesPath}/packages/container/` +
        `${encodeURIComponent(target.packageName)}/versions/${version.id}`
    )
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.status === 403 || error.status === 404)
    ) {
      throw new Error(
        `Not allowed to delete ${target.packageName} versions. On the ` +
          `package's page, under "Manage Actions access", give ` +
          `${target.owner}/${target.repo} the Admin role. (${error.message})`
      )
    }
    throw error
  }
}

function describe(version: PackageVersion): string {
  const tags = version.tags.length > 0 ? version.tags.join(', ') : '(untagged)'
  return `${tags} ${version.digest.slice(0, 19)} ${version.created.slice(0, 10)}`
}

async function summarize(
  verdicts: Verdict[],
  target: Target,
  dryRun: boolean
): Promise<void> {
  const count = (kind: Kind, removed: boolean): string =>
    String(verdicts.filter(v => v.kind === kind && v.remove === removed).length)
  const tagged = verdicts
    .filter(v => v.kind === 'tagged')
    .sort((a, b) => b.version.created.localeCompare(a.version.created))
  const orphanDates = verdicts
    .filter(v => v.kind === 'orphan')
    .map(v => v.version.created.slice(0, 10))
    .sort()
  const verb = dryRun ? 'Would delete' : 'Delete'

  await core.summary
    .addHeading(
      `${target.packageName} image cleanup${dryRun ? ' (dry run)' : ''}`
    )
    .addTable([
      [
        {data: 'Versions', header: true},
        {data: 'Keep', header: true},
        {data: verb, header: true}
      ],
      ['Tagged images', count('tagged', false), count('tagged', true)],
      ['Untagged images', count('orphan', false), count('orphan', true)],
      [
        'Platform images and attestations',
        count('part', false),
        count('part', true)
      ]
    ])
    .addHeading('Tagged images', 3)
    .addTable([
      [
        {data: 'Tags', header: true},
        {data: 'Created', header: true},
        {data: 'Action', header: true},
        {data: 'Why', header: true}
      ],
      ...tagged.map(v => [
        v.version.tags.join(', '),
        v.version.created.slice(0, 10),
        v.remove ? verb : 'Keep',
        v.reason
      ])
    ])
    .addHeading('Untagged images', 3)
    .addRaw(
      orphanDates.length === 0
        ? 'None.'
        : `${orphanDates.length} untagged images, created ${orphanDates[0]} ` +
            `to ${orphanDates.at(-1)}. A deployment may still pin one by ` +
            'digest. They are deleted only with `orphans: delete`.',
      true
    )
    .write()
}

async function run(): Promise<void> {
  const token = core.getInput('token', {required: true})
  const api = new GitHub(token)
  const [owner, repo] = (process.env['GITHUB_REPOSITORY'] ?? '').split('/')
  if (!owner || !repo) {
    throw new Error('GITHUB_REPOSITORY is not set')
  }
  const dryRun = core.getBooleanInput('dry-run')
  const orphans = core.getInput('orphans')
  if (orphans !== 'report' && orphans !== 'delete') {
    throw new Error(`orphans must be "report" or "delete", not "${orphans}"`)
  }

  const account = await api.get<{type: string}>(`/users/${owner}`)
  const target: Target = {
    owner,
    repo,
    packageName: core.getInput('package') || repo,
    packagesPath:
      account.type === 'Organization' ? `/orgs/${owner}` : `/users/${owner}`
  }
  const defaultBranch =
    core.getInput('default-branch') ||
    (await api.get<{default_branch: string}>(`/repos/${owner}/${repo}`))
      .default_branch
  const keepTags = core.getInput('keep-tags')
  const settings: Settings = {
    defaultBranch,
    keepTags: keepTags ? new RegExp(keepTags) : undefined,
    keepDays: wholeNumber('keep-days'),
    keepCount: wholeNumber('keep-count'),
    deleteOrphans: orphans === 'delete',
    orphanMinAgeDays: wholeNumber('orphan-min-age-days'),
    now: new Date()
  }

  const versions = await listVersions(api, target)
  core.info(`${versions.length} versions of ${owner}/${target.packageName}`)
  const facts: Facts = {
    pulls: await listPulls(api, target),
    onDefaultBranch: await onDefaultBranch(
      api,
      target,
      defaultBranch,
      versions
    ),
    children: await readChildren(
      target,
      await registryToken(target, token),
      versions
    )
  }

  const verdicts = plan(versions, settings, facts)
  for (const v of verdicts.filter(v => v.kind !== 'part')) {
    const action = v.remove ? 'DELETE' : 'keep  '
    core.info(`${action} ${describe(v.version)}: ${v.reason}`)
  }
  await summarize(verdicts, target, dryRun)

  // Index before its platform images, so no image is ever left half deleted.
  const order: Kind[] = ['tagged', 'orphan', 'part']
  const doomed = verdicts
    .filter(v => v.remove)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  if (!dryRun) {
    for (const v of doomed) {
      await remove(api, target, v.version)
    }
  }
  core.info(
    `${dryRun ? 'Would delete' : 'Deleted'} ${doomed.length} of ` +
      `${versions.length} versions`
  )
  core.setOutput('planned', doomed.length)
  core.setOutput('deleted', dryRun ? 0 : doomed.length)
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error))
})
