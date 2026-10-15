/**
 * Savborne — Badge logic
 *
 * Rules (spec Section 8):
 *
 *   Badge           | Meaning                        | Removed on withdrawal?
 *   ----------------+--------------------------------+-----------------------
 *   First Steps     | First check-in                 | No
 *   Week Warrior    | One-week streak                | YES
 *   Iron Saver      | Four-week streak (through 11 Nov)| YES
 *   Steady Hand     | No withdrawals for 30 UTC days | No
 *   First Blade     | First battle win               | No
 *   Golden Crown    | Gold bracket status            | No
 *
 * All award/revoke checks are pure. The check-in route (and the future
 * battle-settle route) calls into these evaluators with a snapshot of the
 * player's state and writes the returned instructions to `player_badges`.
 */

import { TIME } from '../constants'
import type { Bracket } from '../constants'

export type BadgeKey =
  | 'first_steps'
  | 'week_warrior'
  | 'iron_saver'
  | 'steady_hand'
  | 'first_blade'
  | 'golden_crown'

export const BADGES: {
  key: BadgeKey
  name: string
  description: string
  revokedOnWithdrawal: boolean
}[] = [
  { key: 'first_steps',   name: 'First Steps',   description: 'Complete your first check-in', revokedOnWithdrawal: false },
  { key: 'week_warrior',  name: 'Week Warrior',  description: 'Keep a seven-day check-in streak', revokedOnWithdrawal: true },
  { key: 'iron_saver',    name: 'Iron Saver',    description: 'Four-week streak through 11 November', revokedOnWithdrawal: true },
  { key: 'steady_hand',   name: 'Steady Hand',   description: 'Thirty consecutive UTC days with no withdrawal', revokedOnWithdrawal: false },
  { key: 'first_blade',   name: 'First Blade',   description: 'Win your first battle', revokedOnWithdrawal: false },
  { key: 'golden_crown',  name: 'Golden Crown',  description: 'Reach the Gold bracket', revokedOnWithdrawal: false },
]

export type BadgeSnapshot = {
  /** Whether the player has ever recorded a check-in. */
  hasAnyCheckIn: boolean
  /** Current consecutive-day streak (with grace applied). */
  streakCurrent: number
  /** Bracket derived from the current balance. */
  bracket: Bracket | null
  /** Whether balance dropped between the two most recent check-ins. */
  withdrawalJustNow: boolean
  /** Whole UTC days elapsed since `steady_hand_started_at` (or 0 if null). */
  daysSinceLastWithdrawalReset: number
  /** Whether the player has ever won a battle. Populated by the battle route. */
  hasBattleWin: boolean
}

export type BadgeAction =
  | { kind: 'award'; badge: BadgeKey }
  | { kind: 'revoke'; badge: BadgeKey }

/**
 * Decide which badges need to be awarded or revoked based on a fresh snapshot.
 * Already-active badges (whose `revoked_at IS NULL` in `player_badges`) are
 * handled by the caller: if the badge is already in the active set, we do not
 * emit an `award` for it. Same for revocations.
 *
 * `alreadyActive` is the set of badge keys the player currently holds.
 */
export function computeBadgeActions(
  snap: BadgeSnapshot,
  alreadyActive: Set<BadgeKey>,
): BadgeAction[] {
  const actions: BadgeAction[] = []

  // ── Awards ──
  if (snap.hasAnyCheckIn && !alreadyActive.has('first_steps')) {
    actions.push({ kind: 'award', badge: 'first_steps' })
  }
  if (snap.streakCurrent >= TIME.weekWarriorStreakDays && !alreadyActive.has('week_warrior')) {
    actions.push({ kind: 'award', badge: 'week_warrior' })
  }
  if (snap.streakCurrent >= TIME.ironSaverStreakDays && !alreadyActive.has('iron_saver')) {
    actions.push({ kind: 'award', badge: 'iron_saver' })
  }
  if (
    snap.daysSinceLastWithdrawalReset >= TIME.steadyHandDays &&
    !alreadyActive.has('steady_hand')
  ) {
    actions.push({ kind: 'award', badge: 'steady_hand' })
  }
  if (snap.hasBattleWin && !alreadyActive.has('first_blade')) {
    actions.push({ kind: 'award', badge: 'first_blade' })
  }
  if (snap.bracket === 'gold' && !alreadyActive.has('golden_crown')) {
    actions.push({ kind: 'award', badge: 'golden_crown' })
  }

  // ── Revocations ──
  // A withdrawal removes ONLY the two streak badges, and only if currently held.
  if (snap.withdrawalJustNow) {
    if (alreadyActive.has('week_warrior')) actions.push({ kind: 'revoke', badge: 'week_warrior' })
    if (alreadyActive.has('iron_saver')) actions.push({ kind: 'revoke', badge: 'iron_saver' })
  }
  // Falling below Gold removes the status badge but not the item (per spec, the
  // item stays in inventory; the badge is displayed only while at Gold).
  if (snap.bracket !== 'gold' && alreadyActive.has('golden_crown')) {
    actions.push({ kind: 'revoke', badge: 'golden_crown' })
  }
  // Losing the streak also drops Week Warrior / Iron Saver (streak back to 0
  // or below threshold means it can no longer be held).
  if (snap.streakCurrent < TIME.weekWarriorStreakDays && alreadyActive.has('week_warrior')) {
    actions.push({ kind: 'revoke', badge: 'week_warrior' })
  }
  if (snap.streakCurrent < TIME.ironSaverStreakDays && alreadyActive.has('iron_saver')) {
    actions.push({ kind: 'revoke', badge: 'iron_saver' })
  }

  return actions
}
