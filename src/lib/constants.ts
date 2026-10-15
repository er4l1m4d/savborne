/**
 * Savborne — Game constants
 *
 * Single source of truth for every tunable number in the game.
 * Mirrors the decisions in docs/Savborne-spec.md and the build plan.
 * If a value changes here, change it in the spec too.
 */

// ─── Currency ────────────────────────────────────────────────────────────────
/** 1 NIM = 100,000 Luna. getBalance returns Luna. */
export const LUNA_PER_NIM = 100_000

// ─── Brackets (spec Section 4.3) ─────────────────────────────────────────────
export const BRACKETS = {
  entry: { label: 'Entry', thresholdNim: 1, color: 'var(--entry)' },
  bronze: { label: 'Bronze', thresholdNim: 3, color: 'var(--bronze)' },
  silver: { label: 'Silver', thresholdNim: 10, color: 'var(--silver)' },
  gold: { label: 'Gold', thresholdNim: 25, color: 'var(--gold)' },
} as const

export type Bracket = keyof typeof BRACKETS

/**
 * Determines the bracket from a balance in Luna.
 * Returns null if the balance is below 1 NIM (no bracket yet).
 */
export function bracketFromLuna(balanceLuna: number): Bracket | null {
  const nim = balanceLuna / LUNA_PER_NIM
  if (nim >= BRACKETS.gold.thresholdNim) return 'gold'
  if (nim >= BRACKETS.silver.thresholdNim) return 'silver'
  if (nim >= BRACKETS.bronze.thresholdNim) return 'bronze'
  if (nim >= BRACKETS.entry.thresholdNim) return 'entry'
  return null
}

// ─── XP & Levels (spec Section 5, plan proposal) ─────────────────────────────
/**
 * XP to advance from level N to level N+1 = 25 × (N + 1).
 * Cumulative: L2=50, L3=125, L4=225, L5=350, L6=500, L7=675, L8=875, L9=1100, L10=1350.
 */
export function xpToNextLevel(currentLevel: number): number {
  return 25 * (currentLevel + 1)
}

/** Cumulative XP required to reach a given level. */
export function cumulativeXpForLevel(level: number): number {
  let total = 0
  for (let n = 1; n < level; n++) total += xpToNextLevel(n)
  return total
}

/** Derive level from cumulative XP. */
export function levelFromXp(totalXp: number): number {
  let level = 1
  let spent = 0
  while (true) {
    const cost = xpToNextLevel(level)
    if (spent + cost > totalXp) return level
    spent += cost
    level++
    if (level > 100) return 100 // safety cap
  }
}

// XP table (spec Section 5.1)
export const XP_VALUES = {
  // Missions — repeatable
  dailyCheckIn: 10,
  quickDuel: 15,
  weeklyCheckIn: 25,
  steadySaver: 35,
  weeklyStrategist: 40,
  // Missions — one-time
  firstSteps: 20,
  risingTide: 30,
  firstBlood: 30,
  tactician: 25,
  bracketClimb: 50,
  // Battles
  battleWin: 30,
  battleLoss: 10,
  battleTie: 15,
} as const

/** Cap on XP earnable from daily missions per UTC day. */
export const DAILY_MISSION_XP_CAP = 25
/** Cap on XP earnable from weekly missions per UTC week. */
export const WEEKLY_MISSION_XP_CAP = 100

// ─── Battles (spec Section 9, plan proposal) ─────────────────────────────────
export const BATTLE = {
  maxTurns: 5,
  startingHp: 100,
  attackDamage: 15,
  specialDamage: 30,
  defendMultiplier: 0.5, // incoming damage × 0.5
  specialCooldown: 1, // turns after use before available again
  turnTimerSeconds: 30,
  dailyLimit: 3,
  challengeExpiryHours: 24,
  reconnectGraceSeconds: 60,
} as const

export type MoveType = 'attack' | 'defend' | 'special' | 'item'

// ─── Ranked (spec Section 10) ────────────────────────────────────────────────
export const RANKED = {
  minLevel: 3,
  minCheckIns: 5,
  startingRating: 1000,
  kFactor: 32,
  ratingFloor: 800,
  /** Rating range widens with wait time (spec 10.3). */
  matchRangeByWaitSeconds: [
    { underSeconds: 60, range: 150 },
    { underSeconds: 120, range: 300 },
    { underSeconds: 180, range: 450 },
    { underSeconds: Infinity, range: 600 },
  ],
  /** Poll interval the client uses to check for a match. */
  pollIntervalMs: 10_000,
  /** Stale threshold — if no poll within this window, entry is dropped. */
  staleAfterSeconds: 30,
} as const

/** Elo expected score: 1 / (1 + 10^((opp - own) / 400)). */
export function eloExpected(ownRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - ownRating) / 400))
}

/**
 * Elo change for a single result.
 * result: 1 = win, 0.5 = tie, 0 = loss
 */
export function eloDelta(ownRating: number, opponentRating: number, result: 0 | 0.5 | 1): number {
  const expected = eloExpected(ownRating, opponentRating)
  const raw = RANKED.kFactor * (result - expected)
  const rounded = Math.round(raw)
  const next = Math.max(RANKED.ratingFloor, ownRating + rounded)
  return next - ownRating
}

// ─── Time rules (spec Section 4.7) ───────────────────────────────────────────
/** All resets run on UTC. Daily = 00:00 UTC, weekly = Monday 00:00 UTC. */
export const TIME = {
  dailyResetUtcHour: 0,
  weeklyResetDayOfWeek: 1, // Monday (JS getUTCDay(): 0=Sun, 1=Mon)
  weekWarriorStreakDays: 7,
  ironSaverStreakDays: 28,
  steadyHandDays: 30,
} as const

// ─── Competition window (spec Section 2.1) ───────────────────────────────────
export const COMPETITION = {
  startDate: '2026-10-14',
  endDate: '2026-11-11',
  earlyAccessDate: '2026-10-28',
  submissionTarget: '2026-11-08',
} as const
