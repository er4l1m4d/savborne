/**
 * Savborne — Item logic
 *
 * Rules (spec Section 7):
 * - Eight items, two per bracket (Entry / Bronze / Silver / Gold).
 * - An item unlocks the first time the player's bracket reaches its tier or
 *   above. Once unlocked, it stays unlocked forever, even if the balance
 *   later drops and the bracket demotes.
 * - Every effect is a fixed modifier. Nothing is chance-based.
 *
 * This module is pure. The check-in route and the player-creation route both
 * call `itemsToUnlock()` with the player's known-bracket history + new bracket
 * and get back the list of item keys that need a fresh `player_items` insert.
 */

import type { Bracket } from '../constants'

export type ItemKey =
  | 'cloth_purse'
  | 'ledger_scroll'
  | 'bronze_shield'
  | 'copper_compass'
  | 'silver_blade'
  | 'silver_charm'
  | 'gold_gauntlet'
  | 'golden_crown'

/** Bracket tier order, lowest first. */
const TIER_ORDER: Bracket[] = ['entry', 'bronze', 'silver', 'gold']

/** Item catalog mirroring the SQL seed in `supabase/migrations/0001_init.sql`. */
export const ITEMS: {
  key: ItemKey
  name: string
  bracket: Bracket
  effectType: string
  effectValue: number
  isBadge: boolean
  blurb: string
}[] = [
  { key: 'cloth_purse',    name: 'Cloth Purse',    bracket: 'entry',  effectType: 'defend_flat_bonus',     effectValue: 1,    isBadge: false, blurb: 'Defend gets +1 for the battle' },
  { key: 'ledger_scroll',  name: 'Ledger Scroll',  bracket: 'entry',  effectType: 'checkin_xp_multiplier', effectValue: 0.05, isBadge: false, blurb: '+5% XP from check-ins' },
  { key: 'bronze_shield',  name: 'Bronze Shield',  bracket: 'bronze', effectType: 'defend_percent',        effectValue: 0.25, isBadge: false, blurb: 'Defend blocks 25% more damage' },
  { key: 'copper_compass', name: 'Copper Compass', bracket: 'bronze', effectType: 'reveal_last_move',      effectValue: 1,    isBadge: false, blurb: "Shows your opponent's last move before you choose yours" },
  { key: 'silver_blade',   name: 'Silver Blade',   bracket: 'silver', effectType: 'attack_percent',        effectValue: 0.1,  isBadge: false, blurb: '+10% Attack damage' },
  { key: 'silver_charm',   name: 'Silver Charm',   bracket: 'silver', effectType: 'special_cooldown',      effectValue: 1,    isBadge: false, blurb: 'Special Move cooldown is one turn shorter' },
  { key: 'gold_gauntlet',  name: 'Gold Gauntlet',  bracket: 'gold',   effectType: 'special_percent',       effectValue: 0.2,  isBadge: false, blurb: '+20% Special Move damage' },
  { key: 'golden_crown',   name: 'Golden Crown',   bracket: 'gold',   effectType: 'status_badge',          effectValue: 1,    isBadge: true,  blurb: 'Status badge on profile and leaderboard' },
]

/**
 * Given the set of item keys the player already owns and their current
 * bracket, return the item keys that qualify for a fresh unlock. Caller
 * writes one `player_items` row per returned key.
 *
 * Passing `null` for `currentBracket` (balance below 1 NIM) returns nothing;
 * the entry floor is 1 NIM.
 */
export function itemsToUnlock(
  alreadyOwnedKeys: Set<ItemKey>,
  currentBracket: Bracket | null,
): ItemKey[] {
  if (currentBracket === null) return []
  const targetTier = TIER_ORDER.indexOf(currentBracket)
  const unlocked: ItemKey[] = []
  for (const item of ITEMS) {
    if (item.isBadge) continue // badges handled separately
    const itemTier = TIER_ORDER.indexOf(item.bracket)
    if (itemTier <= targetTier && !alreadyOwnedKeys.has(item.key)) {
      unlocked.push(item.key)
    }
  }
  return unlocked
}

/** The Golden Crown is an item-linked badge — awarded on gold, never revoked. */
export const GOLDEN_CROWN_KEY: ItemKey = 'golden_crown'
