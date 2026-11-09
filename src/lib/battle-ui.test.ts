import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  battleOutcome,
  battleXpForOutcome,
  battlesLeft,
  formatCountdown,
  nextUtcMidnight,
  queueTimeLabel,
  rankedEligible,
  rankedProgress,
  ratingRangeForWait,
  resultCopy,
  resultSpriteSizes,
} from './battle-ui'

test('battlesLeft uses the daily limit and never goes negative', () => {
  assert.equal(battlesLeft(0), 3)
  assert.equal(battlesLeft(2), 1)
  assert.equal(battlesLeft(3), 0)
  assert.equal(battlesLeft(9), 0)
})

test('rankedEligible requires level, distinct-day check-ins and a bracket', () => {
  assert.equal(rankedEligible({ level: 2, checkInCount: 5, bracket: 'entry' }), false)
  assert.equal(rankedEligible({ level: 3, checkInCount: 4, bracket: 'entry' }), false)
  assert.equal(rankedEligible({ level: 3, checkInCount: 5, bracket: null }), false)
  assert.equal(rankedEligible({ level: 3, checkInCount: 5, bracket: 'entry' }), true)
})

test('rankedProgress caps at the requirement and labels both rows', () => {
  const low = rankedProgress({ level: 1, checkInCount: 2 })
  assert.deepEqual(low.level, { value: 1, max: 3, label: 'Level' })
  assert.deepEqual(low.checkIns, { value: 2, max: 5, label: 'Check-ins' })

  const high = rankedProgress({ level: 9, checkInCount: 9 })
  assert.deepEqual(high.level, { value: 3, max: 3, label: 'Level' })
  assert.deepEqual(high.checkIns, { value: 5, max: 5, label: 'Check-ins' })
})

test('ratingRangeForWait widens at 60, 120 and 180 seconds', () => {
  assert.equal(ratingRangeForWait(0), 150)
  assert.equal(ratingRangeForWait(59), 150)
  assert.equal(ratingRangeForWait(60), 300)
  assert.equal(ratingRangeForWait(119), 300)
  assert.equal(ratingRangeForWait(120), 450)
  assert.equal(ratingRangeForWait(179), 450)
  assert.equal(ratingRangeForWait(180), 600)
  assert.equal(ratingRangeForWait(181), 600)
})

test('queueTimeLabel pads seconds', () => {
  assert.equal(queueTimeLabel(0), '0:00')
  assert.equal(queueTimeLabel(42), '0:42')
  assert.equal(queueTimeLabel(185), '3:05')
})

test('formatCountdown switches between hours, minutes and seconds', () => {
  assert.equal(formatCountdown(0), '0:00')
  assert.equal(formatCountdown(16_000), '0:16')
  assert.equal(formatCountdown(60_000), '1:00')
  assert.equal(formatCountdown((14 * 60 + 52) * 60_000), '14h 52m')
  assert.equal(formatCountdown((23 * 60 + 58) * 60_000), '23h 58m')
})

test('nextUtcMidnight crosses month and year boundaries', () => {
  assert.equal(
    nextUtcMidnight(new Date('2026-11-09T12:00:00.000Z')).toISOString(),
    '2026-11-10T00:00:00.000Z',
  )
  assert.equal(
    nextUtcMidnight(new Date('2026-12-31T23:59:00.000Z')).toISOString(),
    '2027-01-01T00:00:00.000Z',
  )
  assert.equal(
    nextUtcMidnight(new Date('2026-11-09T00:00:00.000Z')).toISOString(),
    '2026-11-10T00:00:00.000Z',
  )
})

test('battleOutcome maps the winner address, tie and loss', () => {
  assert.equal(battleOutcome('NQ01', 'NQ01'), 'win')
  assert.equal(battleOutcome('NQ02', 'NQ01'), 'loss')
  assert.equal(battleOutcome(null, 'NQ01'), 'tie')
})

test('battleXpForOutcome uses the battle XP table', () => {
  assert.equal(battleXpForOutcome('win'), 30)
  assert.equal(battleXpForOutcome('loss'), 10)
  assert.equal(battleXpForOutcome('tie'), 15)
})

test('resultCopy returns the handoff title and tone', () => {
  assert.deepEqual(resultCopy('win'), { title: 'You win!', tone: 'mint' })
  assert.deepEqual(resultCopy('loss'), { title: 'You lost.', tone: 'coral' })
  assert.deepEqual(resultCopy('tie'), { title: "It's a tie.", tone: 'cream' })
})

test('result sprites make the winner larger and a tie equal', () => {
  assert.deepEqual(resultSpriteSizes('win'), { me: 112, opponent: 80 })
  assert.deepEqual(resultSpriteSizes('loss'), { me: 80, opponent: 112 })
  assert.deepEqual(resultSpriteSizes('tie'), { me: 96, opponent: 96 })
})
