import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const ITEMS_PAGE = source('../app/items/page.tsx')
const PROFILE = source('../app/(tabs)/profile/page.tsx')
const BRACKET = source('../app/bracket-climb/page.tsx')
const WITHDRAWAL = source('../app/withdrawal/page.tsx')
const HOME = source('../app/(tabs)/page.tsx')

test('Items is the handoff two-column grid with all eight items', () => {
  assert.match(ITEMS_PAGE, /grid-cols-2/)
  assert.match(ITEMS_PAGE, /ITEMS\.map/)
  assert.match(ITEMS_PAGE, /<ItemArt/)
  assert.match(ITEMS_PAGE, /backHref="\/profile"/)
  assert.match(ITEMS_PAGE, /Still yours/)
})

test('Profile shows the character card and links to Items', () => {
  assert.match(PROFILE, /<CharacterArt/)
  assert.match(PROFILE, /xpProgress/)
  assert.match(PROFILE, /href="\/items"/)
  assert.doesNotMatch(PROFILE, /Inventory/)
})

test('Bracket Climb reads the check-in handoff and points at Items', () => {
  assert.match(BRACKET, /takeBracketHandoff/)
  assert.match(BRACKET, /BRACKETS\[/)
  assert.match(BRACKET, /href="\/items"/)
  assert.match(BRACKET, /Bracket Climb/)
  assert.match(BRACKET, /router\.replace\('\/'\)/)
})

test('Balance dropped reads the handoff and has a single way home', () => {
  assert.match(WITHDRAWAL, /takeWithdrawalHandoff/)
  assert.match(WITHDRAWAL, /name="withdrawal"/)
  assert.match(WITHDRAWAL, /href="\/"/)
  assert.match(WITHDRAWAL, /Still yours/)
  assert.match(WITHDRAWAL, /Removed/)
})

test('Home routes a check-in to the celebration screens', () => {
  assert.match(HOME, /checkInDestination/)
  assert.match(HOME, /writeBracketHandoff/)
  assert.match(HOME, /writeWithdrawalHandoff/)
  assert.match(HOME, /writeCheckInAwards/)
})
