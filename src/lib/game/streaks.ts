/**
 * Savborne — Streak logic
 *
 * Rules (spec §7):
 * - Daily: a check-in on a UTC calendar day counts.
 * - Weekly: at least one check-in in the current UTC week (Mon 00:00 – next Mon 00:00).
 * - Shields: the invisible weekly grace is gone. A player starts with 1 shield,
 *   earns +1 per 7 consecutive days (capped at 3), and spends shields only here,
 *   at check-in, to bridge missed days. A bridge may cross a week boundary.
 *
 * The pure functions below take already-fetched inputs so they can be unit
 * tested without touching the DB.
 */

import { isSameUtcDay, isSameUtcWeek, utcDayOf, utcDaysBetween, utcWeekStart } from './time'

export const SHIELD_CAP = 3

export type StreakInput = {
  /** UTC timestamps of all check-ins for the player, ascending. */
  checkInsAt: Date[]
  /** Server time at the moment of evaluation. */
  now: Date
  /** Current shield count from `players.shields`. */
  shields: number
  /** Lifetime 7-day blocks already awarded, from `players.shields_earned`. */
  shieldsEarned: number
}

export type StreakResult = {
  /** Consecutive-day count including today, after bridging with shields. */
  current: number
  isThisWeekFirstCheckIn: boolean
  /** Shield count after spending and earning. */
  shields: number
  /** Lifetime 7-day blocks awarded, updated. */
  shieldsEarned: number
}

/**
 * Walk the sorted check-in days backwards from `now`, spending shields to
 * bridge missed days. The first gap that cannot be bridged ends the streak.
 */
export function computeStreak(input: StreakInput): StreakResult {
  const { checkInsAt, now, shields, shieldsEarned } = input
  const isThisWeekFirstCheckIn = !hadCheckInThisWeek(checkInsAt, now)

  if (checkInsAt.length === 0) {
    return { current: 0, isThisWeekFirstCheckIn: true, shields, shieldsEarned }
  }

  // Distinct UTC day strings, sorted descending (most recent first).
  const daySet = new Set(checkInsAt.map((d) => utcDayOf(d)))
  const days = Array.from(daySet).sort((a, b) => (a < b ? 1 : -1))

  let current = 0
  let remaining = shields
  let cursor = utcDayOf(now)

  // Leading gap: days missed between the most recent check-in and today. In
  // practice the check-in route has already inserted today's row; this branch
  // is for direct callers and tests.
  const lastCheckInDay = days[0]
  if (lastCheckInDay !== cursor) {
    const leadingGap = utcDaysBetween(new Date(lastCheckInDay), now) - 1
    if (leadingGap > remaining) {
      return finish(0, remaining, shieldsEarned, isThisWeekFirstCheckIn)
    }
    remaining -= leadingGap
    current += leadingGap
    cursor = lastCheckInDay
  }

  for (const day of days) {
    const gap = utcDaysBetween(new Date(day), new Date(cursor))
    if (gap > 1) {
      const missed = gap - 1
      if (missed > remaining) break
      remaining -= missed
      current += missed
    }
    current += 1
    cursor = day
  }

  return finish(current, remaining, shieldsEarned, isThisWeekFirstCheckIn)
}

/**
 * Earnings come from the resulting streak. `remaining + gained` — not
 * `shields + gained` — so a shield spent this check-in is not refunded.
 */
function finish(
  current: number,
  remaining: number,
  shieldsEarned: number,
  isThisWeekFirstCheckIn: boolean,
): StreakResult {
  const blocks = Math.floor(current / 7)
  const gained = Math.max(0, blocks - shieldsEarned)
  return {
    current,
    isThisWeekFirstCheckIn,
    shields: Math.min(SHIELD_CAP, remaining + gained),
    shieldsEarned: Math.max(shieldsEarned, blocks),
  }
}

function hadCheckInThisWeek(checkInsAt: Date[], now: Date): boolean {
  const weekStart = utcWeekStart(now)
  return checkInsAt.some((d) => d >= weekStart && d <= now)
}

/**
 * Whether a check-in today already happened. Used by the check-in route to
 * decide if the Daily Check-in mission should award XP.
 */
export function alreadyCheckedInToday(checkInsAt: Date[], now: Date): boolean {
  return checkInsAt.some((d) => isSameUtcDay(d, now))
}

/** Whether any check-in happened in the current UTC week. */
export function alreadyCheckedInThisWeek(checkInsAt: Date[], now: Date): boolean {
  return checkInsAt.some((d) => isSameUtcWeek(d, now))
}
