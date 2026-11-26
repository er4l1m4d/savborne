import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkedInToday,
  formatHoursMinutes,
  streakAtRisk,
  STREAK_RISK_WINDOW_MS,
} from './checkin-state'

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

test('no streak, no risk cue', () => {
  assert.equal(streakAtRisk(0, '2026-11-08T12:00:00.000Z', now), null)
})

test('a checked-in streak is not at risk', () => {
  assert.equal(streakAtRisk(4, '2026-11-09T08:00:00.000Z', now), null)
})

test('midday leaves the cue off - it is a final-hours warning', () => {
  // 12h left, streak unclaimed: more than the 6h window.
  assert.equal(streakAtRisk(4, '2026-11-08T12:00:00.000Z', now), null)
})

test('the last hours of an unclaimed UTC day do warn', () => {
  const evening = new Date('2026-11-09T19:30:00.000Z') // 4h 30m left
  assert.equal(streakAtRisk(4, '2026-11-08T12:00:00.000Z', evening), 4.5 * 60 * 60 * 1000)
})

test('the cue appears exactly at the window edge and not a second before', () => {
  const edge = new Date('2026-11-09T18:00:00.000Z') // exactly 6h left
  assert.equal(streakAtRisk(4, '2026-11-08T12:00:00.000Z', edge), STREAK_RISK_WINDOW_MS)
  const before = new Date('2026-11-09T17:59:59.000Z')
  assert.equal(streakAtRisk(4, '2026-11-08T12:00:00.000Z', before), null)
})

test('no check-in yet is still an unclaimed day for the cue', () => {
  const evening = new Date('2026-11-09T20:00:00.000Z') // 4h left
  assert.equal(streakAtRisk(2, null, evening), 4 * 60 * 60 * 1000)
})

test('the countdown formats as hours and minutes', () => {
  assert.equal(formatHoursMinutes(4.5 * 60 * 60 * 1000), '4h 30m')
  assert.equal(formatHoursMinutes(60 * 60 * 1000), '1h 0m')
  assert.equal(formatHoursMinutes(42 * 60 * 1000), '42m')
})
