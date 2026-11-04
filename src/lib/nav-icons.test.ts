/**
 * The nav icons are the only art in the app whose source pack is gitignored, so
 * they are extracted into a tracked asset. These assertions are the contract the
 * component relies on; the drift verifier (scripts/nav-icons-verify.mjs) is what
 * checks the asset against the handoff.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

type Icon = { active: string; inactive: string }
const ASSET = JSON.parse(
  readFileSync(new URL('../../assets/nav-icons.json', import.meta.url), 'utf8')
) as { icons: Record<string, Icon> }

const TABS = ['home', 'battle', 'missions', 'ranks', 'profile'] as const

test('there is exactly one icon per nav tab', () => {
  assert.deepEqual(Object.keys(ASSET.icons).sort(), [...TABS].sort())
})

test('both states exist for every tab', () => {
  for (const tab of TABS) {
    assert.match(ASSET.icons[tab].active, /^<svg[\s\S]*<\/svg>$/, `${tab} active`)
    assert.match(ASSET.icons[tab].inactive, /^<svg[\s\S]*<\/svg>$/, `${tab} inactive`)
  }
})

test('icons are 16x16 art rendered at 24px with pixelated scaling', () => {
  for (const tab of TABS) {
    for (const state of ['active', 'inactive'] as const) {
      const svg = ASSET.icons[tab][state]
      assert.match(svg, /viewBox="0 0 16 16"/, `${tab} ${state} viewBox`)
      assert.match(svg, /width="24"/, `${tab} ${state} width`)
      assert.match(svg, /height="24"/, `${tab} ${state} height`)
      assert.match(svg, /image-rendering:\s*pixelated/, `${tab} ${state} scaling`)
    }
  }
})

test('home art changes on active and the other four do not', () => {
  assert.notEqual(ASSET.icons.home.active, ASSET.icons.home.inactive)
  for (const tab of ['battle', 'missions', 'ranks', 'profile'] as const) {
    assert.equal(ASSET.icons[tab].active, ASSET.icons[tab].inactive, `${tab} should not differ`)
  }
})

test('the icons are multi-colour, so they cannot be tinted with currentColor', () => {
  const fills = (svg: string) => new Set([...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/gi)].map((m) => m[1].toUpperCase()))
  for (const tab of TABS) {
    const set = fills(ASSET.icons[tab].inactive)
    assert.ok(set.size >= 2, `${tab} renders as a single colour — the asset has been flattened`)
    assert.ok(!ASSET.icons[tab].inactive.includes('currentColor'), `${tab} must keep literal fills`)
  }
})

test('home active remaps one fill from ember to mint', () => {
  const { active, inactive } = ASSET.icons.home
  assert.ok(inactive.includes('#FF6A4D'), 'inactive home should carry ember')
  assert.ok(active.includes('#6FD0AE'), 'active home should carry mint')
  assert.ok(!active.includes('#FF6A4D'), 'active home should no longer carry ember')
})
