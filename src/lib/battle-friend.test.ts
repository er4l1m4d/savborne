import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PAGE = readFileSync(
  new URL('../app/battle/friend/[id]/page.tsx', import.meta.url),
  'utf8',
)
const CANCEL = readFileSync(
  new URL('../app/api/battles/[id]/cancel/route.ts', import.meta.url),
  'utf8',
)

test('the friend screen shows the waiting pair, expiry and share action', () => {
  assert.match(PAGE, /VersusCards/)
  assert.match(PAGE, /Challenge sent/)
  assert.match(PAGE, /Waiting for a friend/)
  assert.match(PAGE, /challengeExpiryHours/)
  assert.match(PAGE, /formatCountdown/)
  assert.match(PAGE, /Copy challenge link/)
  assert.match(PAGE, /Cancel challenge/)
  assert.match(PAGE, /BottomSheet/)
})

test('the friend screen leaves for an active or completed battle', () => {
  assert.match(PAGE, /router\.replace\(`\/battle\/\$\{id\}`\)/)
  assert.match(PAGE, /router\.replace\(`\/battle\/\$\{id\}\/result`\)/)
  assert.match(PAGE, /state\.viewer\.side !== 'a'/)
})

test('the cancel route is creator-only and guarded by pending + no opponent', () => {
  assert.match(CANCEL, /battle\.player_a !== address/)
  assert.match(CANCEL, /battle\.status !== 'pending' \|\| battle\.player_b !== null/)
  assert.match(CANCEL, /\.eq\('status', 'pending'\)/)
  assert.match(CANCEL, /\.is\('player_b', null\)/)
  assert.match(CANCEL, /status: 'abandoned'/)
})
