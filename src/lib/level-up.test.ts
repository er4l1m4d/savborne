/**
 * Task 17 — the level-up fires exactly once.
 *
 * The bug this guards against is specific and easy to reintroduce: the layout,
 * Home and Profile each mount `usePlayerSession`, so a per-component check
 * would play the arpeggio two or three times for one level. The shared map is
 * what makes "once" true, so it is asserted rather than trusted.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { observeLevel, resetObservedLevels } from './level-up'

test('the first observation is silent — loading at level 5 is not a level-up', () => {
  resetObservedLevels()
  assert.equal(observeLevel('NQ1', 5), false)
})

test('a higher level fires once, and the repeat from another instance does not', () => {
  resetObservedLevels()
  observeLevel('NQ1', 5) // first sighting
  assert.equal(observeLevel('NQ1', 6), true) // real level-up
  assert.equal(observeLevel('NQ1', 6), false) // second hook instance sees the same level
  assert.equal(observeLevel('NQ1', 6), false) // third instance
})

test('a remount at the same level stays silent', () => {
  resetObservedLevels()
  observeLevel('NQ1', 7)
  assert.equal(observeLevel('NQ1', 7), false)
})

test('players are tracked independently', () => {
  resetObservedLevels()
  observeLevel('NQ1', 3)
  observeLevel('NQ2', 9)
  assert.equal(observeLevel('NQ1', 4), true)
  assert.equal(observeLevel('NQ2', 9), false)
})

test('a level drop does not fire, and the next rise compares against the drop', () => {
  resetObservedLevels()
  observeLevel('NQ1', 10)
  assert.equal(observeLevel('NQ1', 8), false)
  assert.equal(observeLevel('NQ1', 9), true)
})

test('a multi-level jump fires exactly once', () => {
  resetObservedLevels()
  observeLevel('NQ1', 2)
  assert.equal(observeLevel('NQ1', 5), true)
  assert.equal(observeLevel('NQ1', 5), false)
})
