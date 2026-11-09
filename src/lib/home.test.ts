import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const FIRST = source('../app/first-checkin/page.tsx')
const HOME = source('../app/(tabs)/page.tsx')

test('First check-in uses the badge and item art', () => {
  assert.match(FIRST, /<BadgeArt/)
  assert.match(FIRST, /<ItemArt/)
  assert.match(FIRST, /Go to Home/)
  assert.match(FIRST, /First Steps/)
})

test('Home uses the wordmark header and character card', () => {
  assert.match(HOME, /title="Savborne"/)
  assert.match(HOME, /<CharacterArt/)
  assert.match(HOME, /xpProgress/)
  assert.match(HOME, /Lv \{player\.level\}/)
})

test('Home owns check-in inside the savings card', () => {
  assert.match(HOME, /checkedInToday/)
  assert.match(HOME, /Check in now/)
  assert.match(HOME, /Checked in today/)
  assert.match(HOME, /since last/)
  assert.match(HOME, /Open vault/)
})

test('Home has the mission rows and Battle card', () => {
  assert.match(HOME, /MissionsPanel/)
  assert.match(HOME, /mission\.name/)
  assert.match(HOME, /Choose opponent/)
  assert.match(HOME, /BATTLE\.dailyLimit/)
})
