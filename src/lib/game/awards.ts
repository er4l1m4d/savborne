/**
 * Savborne — XP award engine
 *
 * Central, server-side function for every XP write in the app. Enforces the
 * daily-mission cap (25 XP/UTC day) and weekly-mission cap (100 XP/UTC week),
 * rolls the level forward when cumulative XP crosses a threshold, and returns
 * a diff describing exactly what was awarded, what was capped, and any level
 * change. All callers (check-in route, battle settle route, mission trigger
 * sites) go through here so caps are never bypassed.
 *
 * The engine itself is pure: it takes an object with the player's current
 * state and returns a patch. The caller (an API route) then writes that patch
 * atomically with whatever else it needs (check-in row, mission row, etc.).
 *
 * Ledger model: XP from a mission counts against that mission's cap bucket.
 * XP from battles and one-time achievements is uncapped. Only mission XP flows
 * through the daily/weekly totals.
 */

import {
  DAILY_MISSION_XP_CAP,
  WEEKLY_MISSION_XP_CAP,
  bracketFromLuna,
  levelFromXp,
  xpToNextLevel,
  type Bracket,
} from '../constants'
import { utcDaysBetween } from './time'

export type XpSource =
  | { kind: 'daily_mission'; key: string }
  | { kind: 'weekly_mission'; key: string }
  | { kind: 'onetime_mission'; key: string }
  | { kind: 'battle'; outcome: 'win' | 'loss' | 'tie' }

export type PlayerXpState = {
  xp: number
  level: number
  dailyXpEarnedToday: number
  weeklyXpEarnedThisWeek: number
}

export type AwardResult = {
  /** XP actually applied to the player's total after any cap. */
  applied: number
  /** XP requested but blocked by a cap. */
  capped: number
  /** Whether a new day rolled over (daily counter should reset). */
  dailyRolled: boolean
  /** Whether a new week rolled over (weekly counter should reset). */
  weeklyRolled: boolean
  /** Level before/after; caller persists if they differ. */
  levelBefore: number
  levelAfter: number
  /** XP needed to go from levelAfter to the next level. */
  xpToNext: number
  /** Whether this award triggered a level-up. */
  leveledUp: boolean
}

/**
 * Compute the effect of awarding `amount` XP to a player from `source`.
 * Does not mutate the input; returns a patch describing what to persist.
 */
export function computeAward(
  state: PlayerXpState,
  amount: number,
  source: XpSource,
): AwardResult {
  let applied = amount
  let capped = 0
  const dailyRolled = false
  const weeklyRolled = false

  // A real implementation reads the last-award timestamps from the DB and
  // sets dailyRolled/weeklyRolled if the stored day/week is behind `now`.
  // That check is done by the caller before invoking this function.

  if (source.kind === 'daily_mission') {
    const headroom = Math.max(0, DAILY_MISSION_XP_CAP - state.dailyXpEarnedToday)
    applied = Math.min(amount, headroom)
    capped = amount - applied
  } else if (source.kind === 'weekly_mission') {
    const headroom = Math.max(0, WEEKLY_MISSION_XP_CAP - state.weeklyXpEarnedThisWeek)
    applied = Math.min(amount, headroom)
    capped = amount - applied
  }

  const newXp = state.xp + applied
  const levelAfter = levelFromXp(newXp)
  return {
    applied,
    capped,
    dailyRolled,
    weeklyRolled,
    levelBefore: state.level,
    levelAfter,
    xpToNext: xpToNextLevel(levelAfter),
    leveledUp: levelAfter > state.level,
  }
}

/**
 * Whether the stored last-award timestamps indicate a new UTC day or week.
 * Given the last daily/weekly reset timestamps (may be null for a brand-new
 * player) and the current instant, returns whether each counter should
 * reset to zero before the award is applied.
 */
export function shouldResetCounters(
  lastDailyResetAt: Date | null,
  lastWeeklyResetAt: Date | null,
  now: Date,
): { dailyRolled: boolean; weeklyRolled: boolean } {
  const dailyRolled =
    lastDailyResetAt === null || utcDaysBetween(lastDailyResetAt, now) >= 1
  const weeklyRolled =
    lastWeeklyResetAt === null ||
    Math.floor(utcDaysBetween(lastWeeklyResetAt, now) / 7) >= 1
  return { dailyRolled, weeklyRolled }
}

/**
 * Compute the delta between two consecutive check-in balances. Positive is
 * growth, negative is withdrawal. Zero if unchanged. Used by the Rising Tide
 * and Steady Saver mission evaluators.
 */
export function balanceDelta(prevLuna: number, currLuna: number): number {
  return currLuna - prevLuna
}

/** Derive the current bracket from a balance. Falls through to `null`. */
export function bracketFromBalance(luna: number): Bracket | null {
  return bracketFromLuna(luna)
}
