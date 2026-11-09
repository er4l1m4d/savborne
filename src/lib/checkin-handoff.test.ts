import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkInDestination } from './checkin-handoff'

test('a withdrawal wins over a bracket change', () => {
  assert.equal(
    checkInDestination({ withdrawalDetected: true, bracketChanged: true, bracket: 'bronze' }),
    'withdrawal',
  )
})

test('a bracket rise lands on the climb screen', () => {
  assert.equal(
    checkInDestination({ withdrawalDetected: false, bracketChanged: true, bracket: 'bronze' }),
    'bracket-climb',
  )
})

test('a drop below the entry floor has no climb screen', () => {
  assert.equal(
    checkInDestination({ withdrawalDetected: false, bracketChanged: true, bracket: null }),
    'home',
  )
})

test('an ordinary check-in stays on home', () => {
  assert.equal(
    checkInDestination({ withdrawalDetected: false, bracketChanged: false, bracket: 'silver' }),
    'home',
  )
})
