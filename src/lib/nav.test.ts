/**
 * The nav is data, not JSX: order, labels and hrefs come from the handoff, while
 * the hrefs themselves stay the app's real routes.
 *
 * isTabActive exists because the old bar compared pathname === href, which
 * highlights nothing on a pushed screen like /battle/123 — the player sees a nav
 * with no current tab while mid-battle.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { NAV_TABS, isTabActive } from './nav'

test('five tabs in the handoff order', () => {
  assert.deepEqual(NAV_TABS.map((t) => t.label), ['Home', 'Battle', 'Missions', 'Ranks', 'Profile'])
})

test('hrefs are the app routes, not the document hrefs', () => {
  assert.deepEqual(NAV_TABS.map((t) => t.href), ['/', '/battle', '/missions', '/leaderboard', '/profile'])
})

test('vault is not a tab', () => {
  assert.ok(!NAV_TABS.some((t) => t.href === '/vault'))
})

test('labels are Title Case, not the old uppercase treatment', () => {
  for (const tab of NAV_TABS) {
    assert.match(tab.label, /^[A-Z][a-z]+$/, `${tab.label} is not Title Case`)
  }
})

test('every icon key exists in the extracted asset, and vice versa', () => {
  const asset = JSON.parse(
    readFileSync(new URL('../../assets/nav-icons.json', import.meta.url), 'utf8')
  ) as { icons: Record<string, unknown> }
  assert.deepEqual(NAV_TABS.map((t) => t.icon).sort(), Object.keys(asset.icons).sort())
})

test('the root tab is active only on the root', () => {
  assert.equal(isTabActive('/', '/'), true)
  assert.equal(isTabActive('/battle', '/'), false)
  assert.equal(isTabActive('/leaderboard', '/'), false)
})

test('a tab is active on its own route and on anything pushed beneath it', () => {
  assert.equal(isTabActive('/battle', '/battle'), true)
  assert.equal(isTabActive('/battle/abc-123', '/battle'), true)
  assert.equal(isTabActive('/leaderboard', '/leaderboard'), true)
  assert.equal(isTabActive('/missions/archive', '/missions'), true)
})

test('a tab is not active on a sibling route that merely shares a prefix', () => {
  assert.equal(isTabActive('/battlefield', '/battle'), false)
  assert.equal(isTabActive('/missions-archive', '/missions'), false)
})
