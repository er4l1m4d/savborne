import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PAGE = readFileSync(
  new URL('../app/battle/[id]/page.tsx', import.meta.url),
  'utf8',
)

test('the battle screen owns the arena, move grid and item sheet', () => {
  assert.match(PAGE, /<Arena/)
  assert.match(PAGE, /<ItemSheet/)
  assert.match(PAGE, /<Meter/)
  assert.match(PAGE, /Choose your move/)
  assert.match(PAGE, /label="Attack"/)
  assert.match(PAGE, /label="Defend"/)
  assert.match(PAGE, /label="Use item"/)
  assert.match(PAGE, /label="Special Move"/)
  assert.match(PAGE, /\(cooldown: 1 turn\)/)
})

test('the battle screen has the wait and connection-lost states', () => {
  assert.match(PAGE, /Your move is locked in/)
  assert.match(PAGE, /Waiting for your opponent to choose\./)
  assert.match(PAGE, /Connection lost\. Your move will be saved/)
  assert.match(PAGE, /Reconnect/)
  assert.match(PAGE, /BATTLE\.reconnectGraceSeconds/)
  assert.match(PAGE, /OFFLINE|offline/)
})

test('the battle screen redirects pending creators and completed battles', () => {
  assert.match(PAGE, /router\.replace\(`\/battle\/friend\/\$\{id\}`\)/)
  assert.match(PAGE, /router\.replace\(`\/battle\/\$\{id\}\/result`\)/)
  assert.match(PAGE, /creatorRedirected/)
  assert.match(PAGE, /completedRedirected/)
})

test('the battle screen uses the additive GET fields', () => {
  assert.match(PAGE, /viewer\.level/)
  assert.match(PAGE, /viewer\.bracket/)
  assert.match(PAGE, /viewer\.ownedItems/)
  assert.match(PAGE, /viewer\.currentMove/)
  assert.match(PAGE, /battle\.opponentLevel/)
  assert.match(PAGE, /battle\.opponentBracket/)
})
