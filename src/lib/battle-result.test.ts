import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const RESULT = readFileSync(
  new URL('../app/battle/[id]/result/page.tsx', import.meta.url),
  'utf8',
)
const BATTLE = readFileSync(new URL('../app/battle/[id]/page.tsx', import.meta.url), 'utf8')

test('the result screen owns the headline, arena, tiles and actions', () => {
  assert.match(RESULT, /<ResultPanel/)
  assert.match(RESULT, /header=/)
  assert.match(RESULT, /battleOutcome/)
  assert.match(RESULT, /battleXpForOutcome/)
  assert.match(RESULT, /resultSpriteSizes/)
  assert.match(RESULT, /titleAlign="center"/)
  assert.match(RESULT, /titleSize="compact"/)
  assert.match(RESULT, /spriteSizes\.me/)
  assert.match(RESULT, /spriteSizes\.opponent/)
  assert.match(RESULT, /Battle win|Battle loss|Battle tie/)
  assert.match(RESULT, /sv-pop/)
  assert.match(RESULT, /Back to Battle/)
  assert.match(RESULT, /Go to Home/)
})

test('the result screen shows the First Blade unlock and items used', () => {
  assert.match(RESULT, /First Blade earned/)
  assert.match(RESULT, /first_blade/)
  assert.match(RESULT, /BadgeArt/)
  assert.match(RESULT, /Items used/)
  assert.match(RESULT, /ItemArt/)
})

test('ranked shows the rating and unranked shows the record', () => {
  assert.match(RESULT, /Ranked rating/)
  assert.match(RESULT, /label: 'Record'/)
  assert.match(RESULT, /Friend · Unranked/)
})

test('a completed battle leaves the battle screen for the result route', () => {
  assert.match(BATTLE, /router\.replace\(`\/battle\/\$\{id\}\/result`\)/)
  assert.match(BATTLE, /completedRedirected/)
})
