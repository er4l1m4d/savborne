import { test } from 'node:test'
import assert from 'node:assert/strict'
import { xpProgress } from './constants'

test('level 7 at 675 starts the XP bar at zero', () => {
  assert.deepEqual(xpProgress(7, 675), { inLevel: 0, toNext: 200 })
})

test('level 7 at 700 is 25 of 200', () => {
  assert.deepEqual(xpProgress(7, 700), { inLevel: 25, toNext: 200 })
})

test('level 1 at zero is 0 of 50', () => {
  assert.deepEqual(xpProgress(1, 0), { inLevel: 0, toNext: 50 })
})
