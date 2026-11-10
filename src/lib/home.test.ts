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

test('Home signs the check-in before it POSTs', () => {
  assert.match(HOME, /signMessage\(checkInMessage/)
  assert.match(HOME, /checkInAuthHeaders/)
  assert.match(HOME, /authHeaders\(checkInAuthHeaders/)
  assert.match(HOME, /checkInErrorMessage/)
})

test('Home has the mission rows and Battle card', () => {
  assert.match(HOME, /MissionsPanel/)
  assert.match(HOME, /mission\.name/)
  assert.match(HOME, /Choose opponent/)
  assert.match(HOME, /BATTLE\.dailyLimit/)
})

test('Home reads the mission payload field the API returns', () => {
  assert.match(HOME, /xpReward: m\.xpReward \?\? m\.xp_reward/)
  assert.doesNotMatch(HOME, /xpReward: m\.xp_reward\b/)
})
