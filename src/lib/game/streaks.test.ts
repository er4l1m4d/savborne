/**
 * Task 6 — streak shields.
 *
 * Shields replace the invisible weekly grace. Consumption is evaluated only
 * here, inside the streak walk:
 *   1. walk check-in days backwards from today
 *   2. for each gap of n missed days, spend min(n, shields) to bridge it
 *   3. if a gap exceeds the shields available, the streak resets there
 *   4. a bridge may cross a week boundary
 *   5. earnings then come from the resulting streak, capped at 3 lifetime blocks
 *
 * The algorithm is one pass with no week-boundary special cases.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { computeStreak } from './streaks'

const NOW = new Date('2026-11-02T12:00:00.000Z') // a Monday

/** `days` calendar days before NOW, as UTC instants (0 = today). */
function daysAgo(...offsets: number[]): Date[] {
  return offsets.map((n) => {
    const d = new Date(NOW)
    d.setUTCDate(d.getUTCDate() - n)
    return d
  })
}

function run(days: Date[], shields: number, shieldsEarned: number) {
  return computeStreak({ checkInsAt: days, now: NOW, shields, shieldsEarned })
}

test('no check-ins leaves the streak at zero and shields untouched', () => {
  const r = run([], 1, 0)
  assert.equal(r.current, 0)
  assert.equal(r.shields, 1)
  assert.equal(r.shieldsEarned, 0)
})

test('three consecutive days keeps the streak and does not earn a shield', () => {
  const r = run(daysAgo(0, 1, 2), 1, 0)
  assert.equal(r.current, 3)
  assert.equal(r.shields, 1)
  assert.equal(r.shieldsEarned, 0)
})

test('seven consecutive days earns one shield', () => {
  const r = run(daysAgo(0, 1, 2, 3, 4, 5, 6), 1, 0)
  assert.equal(r.current, 7)
  assert.equal(r.shields, 2)
  assert.equal(r.shieldsEarned, 1)
})

test('earning past the cap stops at three shields', () => {
  const r = run(daysAgo(0, 1, 2, 3, 4, 5, 6), 3, 0)
  assert.equal(r.current, 7)
  assert.equal(r.shields, 3)
  assert.equal(r.shieldsEarned, 1)
})

test('twenty-one consecutive days earns three shields, capped at three', () => {
  const r = run(daysAgo(...Array.from({ length: 21 }, (_, i) => i)), 1, 0)
  assert.equal(r.current, 21)
  assert.equal(r.shields, 3)
  assert.equal(r.shieldsEarned, 3)
})

test('one missed day is bridged by a shield', () => {
  const r = run(daysAgo(0, 1, 3, 4, 5), 1, 0)
  assert.equal(r.current, 6)
  assert.equal(r.shields, 0)
})

test('one missed day with no shields resets the streak at the gap', () => {
  const r = run(daysAgo(0, 1, 3, 4, 5), 0, 0)
  assert.equal(r.current, 2)
})

test('two missed days exceed a single shield and reset the streak', () => {
  const r = run(daysAgo(0, 1, 4, 5, 6), 1, 0)
  assert.equal(r.current, 2)
})

test('a gap crossing a week boundary is still bridged', () => {
  // NOW is Monday. Check in today, skip Sunday (which belongs to the previous
  // UTC week), and check in Saturday and earlier. The old grace rule refused
  // to bridge a gap that crossed a week boundary; shields must not care.
  const r = run(daysAgo(0, 2, 3, 4), 1, 0)
  assert.equal(r.current, 5)
  assert.equal(r.shields, 0)
  assert.equal(r.shieldsEarned, 0)
})

test('a second seven-day block awards nothing — the cap is lifetime', () => {
  // 14 days, then a reset (gap of 3 with 0 shields), then 7 fresh days.
  const first = daysAgo(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
  const after = computeStreak({
    checkInsAt: first,
    now: new Date('2026-11-02T12:00:00.000Z'),
    shields: 0,
    shieldsEarned: 2,
  })
  assert.equal(after.shieldsEarned, 2)

  const r = run(daysAgo(0, 1, 2, 3, 4, 5, 6), 0, 2)
  assert.equal(r.current, 7)
  assert.equal(r.shields, 0)
  assert.equal(r.shieldsEarned, 2)
})

test('bridging uses shields remaining, not the starting count', () => {
  // 13 days with one gap: the block earns 2 shields, and the spent one must
  // not be refunded. Starting at 1, the result is 2, not 3.
  const r = run(daysAgo(0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13), 1, 0)
  assert.equal(r.current, 14)
  assert.equal(r.shieldsEarned, 2)
  assert.equal(r.shields, 2)
})

test('a gap before the most recent check-in spends shields once', () => {
  const r = run(daysAgo(2, 3, 4), 1, 0)
  assert.equal(r.current, 4)
  assert.equal(r.shields, 0)
})

test('a long absence resets the streak when shields run out', () => {
  const bridged = run(daysAgo(4, 5, 6), 3, 0)
  assert.equal(bridged.current, 6)

  const reset = run(daysAgo(4, 5, 6), 2, 0)
  assert.equal(reset.current, 0)
})
