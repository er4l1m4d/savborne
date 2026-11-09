/**
 * Savborne - rival roster
 *
 * The handoff rolls one of four rivals per battle. The app has no rival column
 * and no schema change in this batch, so the battle id is the stable seed: every
 * poll and both players see the same rival, and a reload does not reroll it.
 */

export const RIVAL_KEYS = [
  'Rival · Mint Wraith',
  'Rival · Hollow Ghost',
  'Rival · Hooded Miser',
  'Rival · Cutpurse',
] as const

export type RivalKey = (typeof RIVAL_KEYS)[number]

export function rivalForBattle(battleId: string): RivalKey {
  let hash = 0
  for (const character of battleId) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0
  }
  return RIVAL_KEYS[hash % RIVAL_KEYS.length]
}
