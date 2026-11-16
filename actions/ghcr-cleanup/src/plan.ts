// Decides which container package versions to delete. Pure: index.ts gathers
// the facts (versions, pull requests, commits, manifests) and performs the
// deletions, so this file has no I/O and can be tested with plain data.

export interface PackageVersion {
  id: number
  /** The manifest digest, `sha256:…` (the package version's `name`). */
  digest: string
  /** ISO 8601 creation time. */
  created: string
  tags: string[]
}

export interface PullRequest {
  number: number
  open: boolean
  headRef: string
  headSha: string
}

export interface Settings {
  defaultBranch: string
  /** Extra tags that always keep their image, such as `^dev$`. */
  keepTags: RegExp | undefined
  /** Default-branch builds younger than this many days are kept. */
  keepDays: number
  /** The newest this many default-branch builds are kept, whatever their age. */
  keepCount: number
  deleteOrphans: boolean
  orphanMinAgeDays: number
  now: Date
}

export interface Facts {
  pulls: PullRequest[]
  /**
   * Whether the commit named by a `sha-<hex>` tag is on the default branch,
   * keyed by the hex part. `false` also covers commits that no longer exist.
   * A missing entry means the lookup failed: the image is kept.
   */
  onDefaultBranch: Map<string, boolean>
  /**
   * Digests each manifest references: the platform images and attestations of
   * an image index, or nothing for a single image. A missing entry means the
   * manifest could not be read.
   */
  children: Map<string, string[]>
}

export type Kind = 'tagged' | 'part' | 'orphan'

export interface Verdict {
  version: PackageVersion
  kind: Kind
  remove: boolean
  reason: string
}

const SHA_TAG = /^sha-([0-9a-f]{7,40})$/
const PR_TAG = /^pr-(\d+)$/
// 1, 1.2, 1.2.3, v1.2.3, 1.3.0-rc.1, 1.2.3+build.5
const VERSION_TAG = /^v?\d+(\.\d+){0,2}([-+][0-9A-Za-z.-]+)?$/
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The image tag a branch is published under: characters Docker tags don't
 * allow become `-`, leading `.` and `-` are dropped, and the result is cut to
 * Docker's 128-character limit. `feat/x` becomes `feat-x`.
 */
export function branchTag(branch: string): string {
  return branch
    .replace(/[^A-Za-z0-9_.-]/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 128)
}

type TagVerdict =
  | {keep: true; reason: string}
  | {keep: false; reason: string}
  | {defaultBranchBuild: true}

function judgeTag(tag: string, settings: Settings, facts: Facts): TagVerdict {
  if (tag === 'latest' || tag === branchTag(settings.defaultBranch)) {
    return {keep: true, reason: `tagged ${tag}`}
  }
  if (VERSION_TAG.test(tag)) {
    return {keep: true, reason: `release ${tag}`}
  }
  if (settings.keepTags?.test(tag)) {
    return {keep: true, reason: `${tag} matches keep-tags`}
  }

  const sha = SHA_TAG.exec(tag)?.[1]
  if (sha !== undefined) {
    const head = facts.pulls.find(p => p.open && p.headSha.startsWith(sha))
    if (head) {
      return {keep: true, reason: `head of open PR #${head.number}`}
    }
    const onDefault = facts.onDefaultBranch.get(sha)
    if (onDefault === undefined) {
      return {keep: true, reason: `commit ${sha} could not be looked up`}
    }
    if (onDefault) {
      return {defaultBranchBuild: true}
    }
    return {
      keep: false,
      reason: `${tag}: not on ${settings.defaultBranch} and not an open PR's head`
    }
  }

  const prNumber = PR_TAG.exec(tag)?.[1]
  const pulls =
    prNumber === undefined
      ? facts.pulls.filter(p => branchTag(p.headRef) === tag)
      : facts.pulls.filter(p => p.number === Number(prNumber))
  if (pulls.length === 0) {
    // Not a PR's branch: a tag someone pushed on purpose, such as `dev`.
    return {keep: true, reason: `${tag} is not a PR branch`}
  }
  const open = pulls.find(p => p.open)
  if (open) {
    return {keep: true, reason: `PR #${open.number} is open`}
  }
  const numbers = pulls.map(p => `#${p.number}`).join(', ')
  return {keep: false, reason: `${tag}: PR ${numbers} closed`}
}

function ageDays(version: PackageVersion, now: Date): number {
  return (now.getTime() - new Date(version.created).getTime()) / DAY_MS
}

function newestFirst(a: PackageVersion, b: PackageVersion): number {
  return b.created.localeCompare(a.created)
}

/** All digests reachable from `roots` through `children`, roots excluded. */
function parts(roots: Iterable<string>, facts: Facts): Set<string> {
  const found = new Set<string>()
  const queue = [...roots]
  for (let digest = queue.pop(); digest !== undefined; digest = queue.pop()) {
    for (const child of facts.children.get(digest) ?? []) {
      if (!found.has(child)) {
        found.add(child)
        queue.push(child)
      }
    }
  }
  return found
}

export function plan(
  versions: PackageVersion[],
  settings: Settings,
  facts: Facts
): Verdict[] {
  const verdicts: Verdict[] = []
  const defaultBranchBuilds: PackageVersion[] = []

  for (const version of versions.filter(v => v.tags.length > 0)) {
    const tagVerdicts = version.tags.map(t => judgeTag(t, settings, facts))
    const keep = tagVerdicts.find(t => 'keep' in t && t.keep)
    if (keep && 'reason' in keep) {
      verdicts.push({
        version,
        kind: 'tagged',
        remove: false,
        reason: keep.reason
      })
      continue
    }
    // A closed PR's tag outweighs a sha tag on the default branch: merging
    // with a merge commit puts the PR's head commit on the default branch,
    // but the default-branch build is the merge commit's image.
    const stale = tagVerdicts.flatMap(t => ('keep' in t ? [t.reason] : []))
    if (stale.length > 0) {
      const reason = stale.join('; ')
      verdicts.push({version, kind: 'tagged', remove: true, reason})
    } else {
      defaultBranchBuilds.push(version)
    }
  }

  defaultBranchBuilds.sort(newestFirst).forEach((version, index) => {
    const branch = settings.defaultBranch
    if (index < settings.keepCount) {
      const reason = `one of the newest ${settings.keepCount} ${branch} builds`
      verdicts.push({version, kind: 'tagged', remove: false, reason})
    } else if (ageDays(version, settings.now) < settings.keepDays) {
      const reason = `${branch} build younger than ${settings.keepDays} days`
      verdicts.push({version, kind: 'tagged', remove: false, reason})
    } else {
      const reason = `${branch} build older than ${settings.keepDays} days`
      verdicts.push({version, kind: 'tagged', remove: true, reason})
    }
  })

  const kept = verdicts.filter(v => !v.remove).map(v => v.version.digest)
  const removed = verdicts.filter(v => v.remove).map(v => v.version.digest)
  const keptParts = parts(kept, facts)
  const removedParts = parts(removed, facts)
  const untagged = versions.filter(v => v.tags.length === 0)

  // Without every kept image's manifest, an untagged version could be one of
  // its platform images: delete nothing untagged.
  const unreadable = kept.find(digest => !facts.children.has(digest))
  if (unreadable !== undefined) {
    const reason = `manifest of kept image ${unreadable} unreadable`
    for (const version of untagged) {
      verdicts.push({version, kind: 'part', remove: false, reason})
    }
    return verdicts
  }

  const orphans: PackageVersion[] = []
  for (const version of untagged) {
    if (keptParts.has(version.digest)) {
      const reason = 'part of a kept image'
      verdicts.push({version, kind: 'part', remove: false, reason})
    } else if (removedParts.has(version.digest)) {
      const reason = 'part of a deleted image'
      verdicts.push({version, kind: 'part', remove: true, reason})
    } else {
      orphans.push(version)
    }
  }

  // An orphan is an untagged image whose tag moved on, such as an old `dev`.
  // A deployment may still pin it by digest, so orphans are only reported
  // unless deleteOrphans is set.
  const orphanParts = parts(
    orphans.map(o => o.digest),
    facts
  )
  const removedOrphans = new Set<string>()
  const keptOrphans = new Set<string>()
  for (const version of orphans.filter(o => !orphanParts.has(o.digest))) {
    const old = ageDays(version, settings.now) >= settings.orphanMinAgeDays
    const remove = settings.deleteOrphans && old
    ;(remove ? removedOrphans : keptOrphans).add(version.digest)
    const reason = remove
      ? `untagged image older than ${settings.orphanMinAgeDays} days`
      : 'untagged image (reported, not deleted)'
    verdicts.push({version, kind: 'orphan', remove, reason})
  }
  const removedOrphanParts = parts(removedOrphans, facts)
  const keptOrphanParts = parts(keptOrphans, facts)
  for (const version of orphans.filter(o => orphanParts.has(o.digest))) {
    const remove =
      removedOrphanParts.has(version.digest) &&
      !keptOrphanParts.has(version.digest)
    const reason = remove
      ? 'part of a deleted untagged image'
      : 'part of an untagged image'
    verdicts.push({version, kind: 'part', remove, reason})
  }

  return verdicts
}
