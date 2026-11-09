import { test } from 'node:test'
import assert from 'node:assert/strict'

import { RIVAL_KEYS, rivalForBattle } from './rivals'

test('the same battle id always rolls the same rival', () => {
  const id = 'b81f4c3e-7a42-4c7a-9e9c-2a1b3c4d5e6f'
  assert.equal(rivalForBattle(id), rivalForBattle(id))
  assert.ok(RIVAL_KEYS.includes(rivalForBattle(id)))
})

test('all four rivals are reachable', () => {
  const ids = Array.from({ length: 24 }, (_, index) => `battle-${index}`)
  const seen = new Set(ids.map(rivalForBattle))
  assert.equal(seen.size, 4)
})
