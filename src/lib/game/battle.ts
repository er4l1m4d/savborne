/**
 * Savborne — Battle engine (pure)
 *
 * All battle math lives here: damage calculation with item modifiers, turn
 * resolution, the special-move cooldown, win/tie determination, and the
 * deterministic AI strategy from spec Section 11.2.
 *
 * The engine is PURE — no DB, no async. API routes feed it state snapshots
 * and persist the returned instructions. That keeps every battle outcome
 * reproducible and unit-testable, and honours the "battles use no chance"
 * rule (spec 9.1): given identical moves and items, the outcome is identical.
 *
 * Damage model (plan proposal, spec 9.2 + 11):
 *   Each move has a base attack value: Attack 15, Special 30, Defend 0, Item 0.
 *   Damage dealt to the opponent =
 *       base
 *     × (attacker item bonus for that move, if any)
 *     × (opponent is defending ? defendMultiplier : 1)
 *     − flat defend reduction (Cloth Purse), floored at 0
 *   then floored to an integer.
 *
 * Item activation: "Use item" is a turn action (spec 9.2). Activating costs
 * the turn — you neither attack nor defend — but the effect persists for the
 * rest of the battle. Each item can be activated once per battle.
 */

import { BATTLE, XP_VALUES, type MoveType } from '../constants'
import type { ItemKey } from './items'

export type BattleMove = MoveType // 'attack' | 'defend' | 'special' | 'item'

/** Aggregate modifiers from the items a combatant has ACTIVE this battle. */
export type ItemMods = {
  defendPercentBonus: number // Bronze Shield: 0.25
  defendFlatReduce: number // Cloth Purse: 1
  attackPercent: number // Silver Blade: 0.10
  specialPercent: number // Gold Gauntlet: 0.20
  specialCooldownOff: boolean // Silver Charm: special usable on consecutive turns
  revealsLastMove: boolean // Copper Compass
}

export const NO_MODS: ItemMods = {
  defendPercentBonus: 0,
  defendFlatReduce: 0,
  attackPercent: 0,
  specialPercent: 0,
  specialCooldownOff: false,
  revealsLastMove: false,
}

/** Map item keys to their active-loadout effect. */
export function modsForItems(activeItemKeys: Iterable<ItemKey>): ItemMods {
  const mods = { ...NO_MODS }
  for (const key of activeItemKeys) {
    switch (key) {
      case 'bronze_shield': mods.defendPercentBonus = 0.25; break
      case 'cloth_purse': mods.defendFlatReduce = 1; break
      case 'silver_blade': mods.attackPercent = 0.1; break
      case 'gold_gauntlet': mods.specialPercent = 0.2; break
      case 'silver_charm': mods.specialCooldownOff = true; break
      case 'copper_compass': mods.revealsLastMove = true; break
      default: break // ledger_scroll and golden_crown have no battle modifier
    }
  }
  return mods
}

function baseDamage(move: BattleMove): number {
  if (move === 'attack') return BATTLE.attackDamage
  if (move === 'special') return BATTLE.specialDamage
  return 0
}

/**
 * Damage that `attackerMove` deals to a defender playing `defenderMove`.
 * Defender item mods mitigate; attacker item mods amplify.
 */
export function effectiveDamage(
  attackerMove: BattleMove,
  defenderMove: BattleMove,
  attackerMods: ItemMods,
  defenderMods: ItemMods,
): number {
  let dmg = baseDamage(attackerMove)
  if (dmg === 0) return 0
  if (attackerMove === 'attack') dmg *= 1 + attackerMods.attackPercent
  if (attackerMove === 'special') dmg *= 1 + attackerMods.specialPercent
  if (defenderMove === 'defend') {
    const multiplier = BATTLE.defendMultiplier * (1 - defenderMods.defendPercentBonus)
    dmg = dmg * multiplier - defenderMods.defendFlatReduce
  }
  return Math.max(0, Math.floor(dmg))
}

export type TurnSide = {
  move: BattleMove
  mods: ItemMods
}

export type TurnOutcome = {
  damageToA: number
  damageToB: number
}

/** Resolve one simultaneous turn. */
export function resolveTurn(a: TurnSide, b: TurnSide): TurnOutcome {
  return {
    damageToA: effectiveDamage(b.move, a.move, b.mods, a.mods),
    damageToB: effectiveDamage(a.move, b.move, a.mods, b.mods),
  }
}

/** Whether the Special Move is available this turn given the last move used. */
export function specialAvailable(lastMove: BattleMove | null, mods: ItemMods): boolean {
  if (mods.specialCooldownOff) return true
  return lastMove !== 'special'
}

export type BattleOver = {
  over: boolean
  winner: 'a' | 'b' | 'tie' | null // null while not over
  reason: 'ko' | 'turns' | null
}

/** A battle ends when either HP hits 0 or turn 5 resolves. Higher HP wins. */
export function checkBattleOver(hpA: number, hpB: number, turnsResolved: number): BattleOver {
  if (hpA <= 0 || hpB <= 0) {
    const winner = hpA <= 0 && hpB <= 0 ? 'tie' : hpA <= 0 ? 'b' : 'a'
    return { over: true, winner, reason: 'ko' }
  }
  if (turnsResolved >= BATTLE.maxTurns) {
    const winner = hpA > hpB ? 'a' : hpB > hpA ? 'b' : 'tie'
    return { over: true, winner, reason: 'turns' }
  }
  return { over: false, winner: null, reason: null }
}

// ─── AI opponent (spec 11.2 — fixed strategy, no randomness) ────────────────

export type AiContext = {
  aiHp: number
  maxHp: number
  turnNumber: number // 1-based, the turn the AI is choosing for
  aiSpecialAvailable: boolean
  playerLastMove: BattleMove | null // null on turn 1
}

/**
 * Turn priorities, checked in order (spec 11.2):
 * 1. AI health below 30% AND player used Attack last turn → Defend.
 * 2. Special available AND (turn 3 or turn 5) → Special Move.
 * 3. Player used Defend last turn → Attack.
 * 4. Otherwise → Attack.
 */
export function aiChooseMove(ctx: AiContext): BattleMove {
  const lowHealth = ctx.aiHp < ctx.maxHp * 0.3
  if (lowHealth && ctx.playerLastMove === 'attack') return 'defend'
  if (ctx.aiSpecialAvailable && (ctx.turnNumber === 3 || ctx.turnNumber === 5)) return 'special'
  if (ctx.playerLastMove === 'defend') return 'attack'
  return 'attack'
}

/**
 * AI loadout decision (spec 11.2, last paragraph): the AI starts with its
 * Bronze Shield and Silver Blade active if it "owns" them. For the single v1
 * difficulty the AI owns both only when the player has reached at least the
 * Bronze bracket — the AI never out-gears the player, and Entry-tier
 * beginners face a plain opponent. Documented design decision.
 */
export function aiStartingItems(playerBracketReachedBronze: boolean): ItemKey[] {
  return playerBracketReachedBronze ? ['bronze_shield', 'silver_blade'] : []
}

// ─── Battle XP (spec 9.6) ───────────────────────────────────────────────────

export function battleXp(winner: 'a' | 'b' | 'tie', perspective: 'a' | 'b'): number {
  if (winner === 'tie') return XP_VALUES.battleTie
  return winner === perspective ? XP_VALUES.battleWin : XP_VALUES.battleLoss
}
