/**
 * Savborne — Mission evaluation
 *
 * Given a snapshot of the player's state (check-ins, wins, current bracket,
 * whether they used both Defend and Special in a battle, etc.), decide which
 * missions are qualified-but-not-yet-credited and what XP each is worth.
 *
 * Repeatable missions reset on the wire: Daily Check-in and Quick Duel reset
 * every UTC day (00:00 UTC), the three weekly missions reset every Monday
 * 00:00 UTC. One-time missions never re-award once credited.
 *
 * This module is pure. The check-in route calls `evaluateForCheckIn()` after
 * writing a fresh check-in row; the battle-settle route calls
 * `evaluateForBattle()` inside its transaction.
 */

import { XP_VALUES, type Bracket } from '../constants'

export type MissionKey =
  | 'first_steps'
  | 'rising_tide'
  | 'first_blood'
  | 'tactician'
  | 'bracket_climb'
  | 'daily_check_in'
  | 'quick_duel'
  | 'weekly_check_in'
  | 'steady_saver'
  | 'weekly_strategist'

export type CompletedMission = {
  key: MissionKey
  xp: number
  /** Whether this is a one-time mission (never awarded again after first credit). */
  isOnetime: boolean
}

export type CheckInSnapshot = {
  /** Balance in Luna of the just-recorded check-in. */
  currentBalanceLuna: number
  /** Balance in Luna of the immediately prior check-in (any date), or null if none. */
  previousBalanceLuna: number | null
  /** Balance in Luna of the first check-in in the current UTC week. */
  weekOpeningBalanceLuna: number | null
  /** Whether balance ever dropped between consecutive check-ins this week. */
  anyWithdrawalThisWeek: boolean
  /** Whether any check-in has already been recorded this UTC day. */
  alreadyCheckedInToday: boolean
  /** Whether any check-in had been recorded earlier in this UTC week (before now). */
  alreadyCheckedInThisWeek: boolean
  /** Total check-ins ever (used to gate "First Steps"). */
  totalCheckInsBefore: number
  /** Current bracket after this check-in (may be null if below 1 NIM). */
  currentBracket: Bracket | null
}

/** Missions newly qualified by a check-in. Returns [] if nothing earned. */
export function evaluateForCheckIn(snap: CheckInSnapshot): CompletedMission[] {
  const earned: CompletedMission[] = []

  if (snap.totalCheckInsBefore === 0) {
    earned.push({ key: 'first_steps', xp: XP_VALUES.firstSteps, isOnetime: true })
  }

  if (
    !snap.alreadyCheckedInToday &&
    snap.currentBalanceLuna >= 0 // any valid read
  ) {
    earned.push({ key: 'daily_check_in', xp: XP_VALUES.dailyCheckIn, isOnetime: false })
  }

  if (!snap.alreadyCheckedInThisWeek) {
    earned.push({ key: 'weekly_check_in', xp: XP_VALUES.weeklyCheckIn, isOnetime: false })
  }

  if (snap.previousBalanceLuna !== null && snap.currentBalanceLuna > snap.previousBalanceLuna) {
    earned.push({ key: 'rising_tide', xp: XP_VALUES.risingTide, isOnetime: true })
  }

  if (
    snap.weekOpeningBalanceLuna !== null &&
    !snap.anyWithdrawalThisWeek &&
    snap.currentBalanceLuna >= snap.weekOpeningBalanceLuna
  ) {
    earned.push({ key: 'steady_saver', xp: XP_VALUES.steadySaver, isOnetime: false })
  }

  if (snap.currentBracket === 'bronze' || snap.currentBracket === 'silver' || snap.currentBracket === 'gold') {
    // Bracket Climb fires the first time a player reaches Bronze or higher.
    earned.push({ key: 'bracket_climb', xp: XP_VALUES.bracketClimb, isOnetime: true })
  }

  return earned
}

export type BattleSnapshot = {
  /** Whether the battle was against a real human (ranked or friend). */
  isHumanOpponent: boolean
  /** Outcome from the caller's perspective. */
  outcome: 'win' | 'loss' | 'tie'
  /** Whether the caller used Defend at least once this battle. */
  usedDefend: boolean
  /** Whether the caller used Special Move at least once this battle. */
  usedSpecial: boolean
  /** How many distinct battles started in this UTC week (before this one). */
  weeklyWinsBefore: number
  /** Whether this was the caller's first battle of the current UTC day. */
  firstBattleToday: boolean
}

/** Missions newly qualified by finishing a battle. */
export function evaluateForBattle(snap: BattleSnapshot): CompletedMission[] {
  const earned: CompletedMission[] = []

  if (snap.isHumanOpponent && snap.outcome === 'win') {
    earned.push({ key: 'first_blood', xp: XP_VALUES.firstBlood, isOnetime: true })
  }

  if (snap.usedDefend && snap.usedSpecial) {
    earned.push({ key: 'tactician', xp: XP_VALUES.tactician, isOnetime: true })
  }

  // Weekly Strategist: 2 wins this week. The caller filters by "not already
  // credited this week" before applying this award.
  if (snap.isHumanOpponent && snap.outcome === 'win' && snap.weeklyWinsBefore + 1 >= 2) {
    earned.push({
      key: 'weekly_strategist',
      xp: XP_VALUES.weeklyStrategist,
      isOnetime: false,
    })
  }

  if (snap.firstBattleToday) {
    earned.push({ key: 'quick_duel', xp: XP_VALUES.quickDuel, isOnetime: false })
  }

  return earned
}
