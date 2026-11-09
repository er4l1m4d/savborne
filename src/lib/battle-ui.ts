/**
 * Savborne - Battle UI helpers (pure)
 *
 * The Battle screens share these small decisions so the menu, queue, arena and
 * result do not each invent their own limit, countdown or outcome rule.
 */

import { BATTLE, RANKED, XP_VALUES, type Bracket } from './constants'

/** Battles still available today, never negative. */
export function battlesLeft(battlesToday: number): number {
  return Math.max(0, BATTLE.dailyLimit - Math.max(0, battlesToday))
}

/**
 * The same gate `/api/queue/join` enforces. A bracket is required because the
 * queue pairs players inside one bracket.
 */
export function rankedEligible(player: {
  level: number
  checkInCount: number
  bracket: Bracket | null
}): boolean {
  return (
    player.level >= RANKED.minLevel &&
    player.checkInCount >= RANKED.minCheckIns &&
    player.bracket !== null
  )
}

export type RankedBar = { value: number; max: number; label: string }

/** Requirement bars, capped so a level-9 player still reads 3 of 3. */
export function rankedProgress(player: {
  level: number
  checkInCount: number
}): { level: RankedBar; checkIns: RankedBar } {
  return {
    level: {
      value: Math.min(Math.max(0, player.level), RANKED.minLevel),
      max: RANKED.minLevel,
      label: 'Level',
    },
    checkIns: {
      value: Math.min(Math.max(0, player.checkInCount), RANKED.minCheckIns),
      max: RANKED.minCheckIns,
      label: 'Check-ins',
    },
  }
}

/** The rating window for a wait, matching the server's match_me schedule. */
export function ratingRangeForWait(seconds: number): number {
  const wait = Math.max(0, seconds)
  return (
    RANKED.matchRangeByWaitSeconds.find((window) => wait < window.underSeconds)?.range ?? 600
  )
}

/** Queue clock: 0:42, 3:05. */
export function queueTimeLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Countdown wording:
 *   14h 52m above an hour, 1:00 below it, 0:16 below a minute, 0:00 at zero.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const total = Math.ceil(ms / 1000)
  if (total >= 3600) {
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** The next 00:00:00.000Z strictly after `now`. */
export function nextUtcMidnight(now: Date): Date {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return next
}

export type BattleResult = 'win' | 'loss' | 'tie'

/** Which side of a completed battle the viewer is on. A null winner is a tie. */
export function battleOutcome(winner: string | null, viewerAddress: string): BattleResult {
  if (!winner) return 'tie'
  return winner === viewerAddress ? 'win' : 'loss'
}

export function battleXpForOutcome(outcome: BattleResult): number {
  if (outcome === 'win') return XP_VALUES.battleWin
  if (outcome === 'loss') return XP_VALUES.battleLoss
  return XP_VALUES.battleTie
}

export function resultCopy(outcome: BattleResult): {
  title: string
  tone: 'mint' | 'coral' | 'cream'
} {
  if (outcome === 'win') return { title: 'You win!', tone: 'mint' }
  if (outcome === 'loss') return { title: 'You lost.', tone: 'coral' }
  return { title: "It's a tie.", tone: 'cream' }
}
