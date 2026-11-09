import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkedInToday } from './checkin-state'

const now = new Date('2026-11-09T12:00:00.000Z')

test('an earlier check-in the same UTC day is today', () => {
  assert.equal(checkedInToday('2026-11-09T00:01:00.000Z', now), true)
})

test('a check-in on the previous UTC day is not today', () => {
  assert.equal(checkedInToday('2026-11-08T23:59:00.000Z', now), false)
})

test('no check-in is not today', () => {
  assert.equal(checkedInToday(null, now), false)
})
