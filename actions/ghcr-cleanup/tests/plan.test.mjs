// Run with `npm test`. Node strips the types from ../src/plan.ts itself.
import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {branchTag, plan} from '../src/plan.ts'

const NOW = new Date('2026-11-16T12:00:00Z')

let nextId = 1
function version(tags, daysOld = 0, digest = undefined) {
  const id = nextId++
  return {
    id,
    digest: digest ?? `sha256:${String(id).padStart(64, '0')}`,
    created: new Date(NOW.getTime() - daysOld * 86_400_000).toISOString(),
    tags
  }
}

function settings(overrides = {}) {
  return {
    defaultBranch: 'main',
    keepTags: undefined,
    keepDays: 30,
    keepCount: 2,
    deleteOrphans: false,
    orphanMinAgeDays: 30,
    now: NOW,
    ...overrides
  }
}

function facts(overrides = {}) {
  return {
    pulls: [],
    onDefaultBranch: new Map(),
    children: new Map(),
    ...overrides
  }
}

/** Every version gets an empty manifest unless the test sets one. */
function withManifests(versions, children = new Map()) {
  for (const v of versions) {
    if (!children.has(v.digest)) children.set(v.digest, [])
  }
  return children
}

function removed(verdicts) {
  return verdicts.filter(v => v.remove).map(v => v.version.id)
}

describe('branchTag', () => {
  it('replaces characters Docker tags do not allow', () => {
    assert.equal(branchTag('fix/ci-review-bugs'), 'fix-ci-review-bugs')
    assert.equal(
      branchTag('dependabot/npm_and_yarn/@biomejs/biome-2.5.14'),
      'dependabot-npm_and_yarn--biomejs-biome-2.5.14'
    )
  })

  it('drops leading dots and dashes and cuts at 128 characters', () => {
    assert.equal(branchTag('.weird//Name+x'), 'weird--Name-x')
    assert.equal(branchTag('a'.repeat(200)).length, 128)
  })
})

describe('tagged images', () => {
  it('keeps latest, the default branch, releases and keep-tags', () => {
    const versions = [
      version(['latest'], 400),
      version(['main'], 400),
      version(['1.2.3', '1.2', '1'], 400),
      version(['v1.0.1', 'v1'], 400),
      version(['1.3.0-rc.1'], 400),
      version(['dev'], 400)
    ]
    const verdicts = plan(
      versions,
      settings({keepTags: /^dev$/}),
      facts({children: withManifests(versions)})
    )
    assert.deepEqual(removed(verdicts), [])
  })

  it('deletes images of closed PRs and keeps those of open ones', () => {
    const closed = version(['fix-old'], 1)
    const open = version(['feat-new'], 1)
    const legacyClosed = version(['pr-7'], 1)
    const legacyOpen = version(['pr-8'], 1)
    const versions = [closed, open, legacyClosed, legacyOpen]
    const pulls = [
      {number: 5, open: false, headRef: 'fix/old', headSha: 'a'.repeat(40)},
      {number: 6, open: true, headRef: 'feat/new', headSha: 'b'.repeat(40)},
      {number: 7, open: false, headRef: 'x', headSha: 'c'.repeat(40)},
      {number: 8, open: true, headRef: 'y', headSha: 'd'.repeat(40)}
    ]
    const verdicts = plan(
      versions,
      settings(),
      facts({pulls, children: withManifests(versions)})
    )
    assert.deepEqual(removed(verdicts), [closed.id, legacyClosed.id])
  })

  it('keeps a tag that is no PR branch, such as dev', () => {
    const versions = [version(['dev'], 400), version(['pr-99'], 400)]
    const verdicts = plan(
      versions,
      settings(),
      facts({children: withManifests(versions)})
    )
    assert.deepEqual(removed(verdicts), [])
  })

  it('keeps the newest and the young default-branch builds', () => {
    const builds = [
      version(['sha-0000001'], 1),
      version(['sha-0000002'], 40),
      version(['sha-0000003'], 20),
      version(['sha-0000004'], 50),
      version(['sha-0000005'], 60)
    ]
    const onDefaultBranch = new Map(builds.map(b => [b.tags[0].slice(4), true]))
    const verdicts = plan(
      builds,
      settings({keepCount: 2, keepDays: 30}),
      facts({onDefaultBranch, children: withManifests(builds)})
    )
    // Newest two: 1 and 3. Younger than 30 days: 1 and 3. The rest go.
    assert.deepEqual(removed(verdicts).sort(), [
      builds[1].id,
      builds[3].id,
      builds[4].id
    ])
  })

  it('deletes superseded PR builds, keeps the head and unknown commits', () => {
    const superseded = version(['sha-aaaaaaa'], 1)
    const head = version(['sha-bbbbbbb'], 1)
    const unknown = version(['sha-ccccccc'], 1)
    const versions = [superseded, head, unknown]
    const pulls = [
      {
        number: 6,
        open: true,
        headRef: 'feat/x',
        headSha: 'bbbbbbb' + '0'.repeat(33)
      }
    ]
    const onDefaultBranch = new Map([['aaaaaaa', false]])
    const verdicts = plan(
      versions,
      settings(),
      facts({pulls, onDefaultBranch, children: withManifests(versions)})
    )
    assert.deepEqual(removed(verdicts), [superseded.id])
  })

  it('deletes a merged PR image even though its commit is on main', () => {
    const merged = version(['sha-eeeeeee', 'fix-merged'], 1)
    const pulls = [
      {number: 9, open: false, headRef: 'fix/merged', headSha: 'e'.repeat(40)}
    ]
    const onDefaultBranch = new Map([['eeeeeee', true]])
    const verdicts = plan(
      [merged],
      settings(),
      facts({pulls, onDefaultBranch, children: withManifests([merged])})
    )
    assert.deepEqual(removed(verdicts), [merged.id])
  })

  it('keeps an image when any one of its tags keeps it', () => {
    const v = version(['fix-old', 'latest'], 100)
    const pulls = [{number: 5, open: false, headRef: 'fix/old', headSha: 'a'}]
    const verdicts = plan(
      [v],
      settings(),
      facts({pulls, children: withManifests([v])})
    )
    assert.deepEqual(removed(verdicts), [])
  })
})

describe('untagged versions', () => {
  it('deletes the parts of a deleted image but not parts a kept image shares', () => {
    const shared = version([], 10)
    const ownPart = version([], 10)
    const keptPart = version([], 10)
    const doomed = version(['fix-old'], 10)
    const kept = version(['latest'], 10)
    const versions = [shared, ownPart, keptPart, doomed, kept]
    const children = withManifests(
      versions,
      new Map([
        [doomed.digest, [shared.digest, ownPart.digest]],
        [kept.digest, [shared.digest, keptPart.digest]]
      ])
    )
    const pulls = [{number: 5, open: false, headRef: 'fix/old', headSha: 'a'}]
    const verdicts = plan(versions, settings(), facts({pulls, children}))
    assert.deepEqual(removed(verdicts).sort(), [ownPart.id, doomed.id].sort())
  })

  it('deletes nothing untagged when a kept manifest is unreadable', () => {
    const part = version([], 10)
    const doomed = version(['fix-old'], 10)
    const kept = version(['latest'], 10)
    const children = new Map([
      [doomed.digest, [part.digest]],
      [part.digest, []]
    ])
    const pulls = [{number: 5, open: false, headRef: 'fix/old', headSha: 'a'}]
    const verdicts = plan(
      [part, doomed, kept],
      settings(),
      facts({pulls, children})
    )
    assert.deepEqual(removed(verdicts), [doomed.id])
  })

  it('only reports untagged images by default', () => {
    const orphan = version([], 400)
    const part = version([], 400)
    const versions = [orphan, part]
    const children = withManifests(
      versions,
      new Map([[orphan.digest, [part.digest]]])
    )
    const verdicts = plan(versions, settings(), facts({children}))
    assert.deepEqual(removed(verdicts), [])
    assert.equal(verdicts.find(v => v.version === orphan).kind, 'orphan')
  })

  it('deletes old untagged images with orphans: delete, sparing shared parts', () => {
    const old = version([], 40)
    const young = version([], 5)
    const oldPart = version([], 40)
    const sharedPart = version([], 40)
    const versions = [old, young, oldPart, sharedPart]
    const children = withManifests(
      versions,
      new Map([
        [old.digest, [oldPart.digest, sharedPart.digest]],
        [young.digest, [sharedPart.digest]]
      ])
    )
    const verdicts = plan(
      versions,
      settings({deleteOrphans: true, orphanMinAgeDays: 30}),
      facts({children})
    )
    assert.deepEqual(removed(verdicts).sort(), [old.id, oldPart.id].sort())
  })
})
