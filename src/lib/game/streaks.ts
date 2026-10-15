/**
 * Savborne — Streak logic
 *
 * Rules (spec 4.4):
 * - Daily: a check-in on a UTC calendar day counts.
 * - Weekly: at least one check-in in the current UTC week (Mon 00:00 – next Mon 00:00).
 * - Grace: ONE missed day per UTC week is forgiven; the grace does not stack
 *   and resets at Monday 00:00 UTC.
 * - Week resets on Monday 00:00 UTC.
 *
 * The pure functions below take already-fetched inputs so they can be unit
 * tested without touching the DB.
 */

import {
  isSameUtcDay,
  isSameUtcWeek,
  utcDayOf,
  utcDaysBetween,
  utcWeekStart,
} from './time'

export type StreakInput = {
  /** UTC timestamps of all check-ins for the player, ascending. */
  checkInsAt: Date[]
  /** Server time at the moment of evaluation. */
  now: Date
}

export type StreakResult = {
  /** Consecutive-day count including today, honoring the grace rule. */
  current: number
  /** Longest ever reached, updated by the caller if current > previous best. */
  isThisWeekFirstCheckIn: boolean
  /** Whether the player has used this week's grace day already. */
  graceUsedThisWeek: boolean
}

/**
 * Walk the sorted check-in dates backwards from `now` and count how many
 * UTC days in a row the player checked in, tolerating one missed day per
 * week. Any miss beyond the grace resets the streak to the days since the
 * most recent gap.
 */
export function computeStreak(input: StreakInput): StreakResult {
  const { checkInsAt, now } = input
  if (checkInsAt.length === 0) {
    return { current: 0, isThisWeekFirstCheckIn: true, graceUsedThisWeek: false }
  }

  // Distinct UTC day strings, sorted descending (most recent first).
  const daySet = new Set(checkInsAt.map((d) => utcDayOf(d)))
  const days = Array.from(daySet).sort((a, b) => (a < b ? 1 : -1))

  const todayStr = utcDayOf(now)
  const lastCheckInDay = days[0]

  // If the player has NOT checked in today or yesterday, streak is broken.
  const daysSinceLast = utcDaysBetween(new Date(lastCheckInDay), now)
  if (daysSinceLast > 1) {
    return { current: 0, isThisWeekFirstCheckIn: !hadCheckInThisWeek(checkInsAt, now), graceUsedThisWeek: false }
  }

  // Walk backwards from the most recent check-in day, counting a streak.
  // One gap (a missing day) is allowed if it falls inside the current week.
  const weekStart = utcWeekStart(now)
  let current = 0
  let graceUsed = false
  let cursor = lastCheckInDay

  for (const day of days) {
    const gap = utcDaysBetween(new Date(day), new Date(cursor))
    if (gap > 1) {
      // There is at least one missed day between `day` and `cursor`.
      const missedDaysBetween = gap - 1
      if (missedDaysBetween >= 2 || graceUsed) {
        // Two-miss, or an additional miss after grace was used — streak broken.
        break
      }
      // Single missed day inside the week → grace applies.
      const missedDayStart = new Date(day)
      missedDayStart.setUTCDate(missedDayStart.getUTCDate() + 1)
      if (missedDayStart < weekStart) {
        // The gap crosses into a previous week — cannot use current week's grace.
        break
      }
      graceUsed = true
      current += missedDaysBetween
    }
    current += 1
    cursor = day
  }

  return {
    current,
    isThisWeekFirstCheckIn: !hadCheckInThisWeek(checkInsAt, now),
    graceUsedThisWeek: graceUsed,
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
