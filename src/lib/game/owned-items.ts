/**
 * Savborne - which item keys a player owns
 *
 * `player_items` is the canonical unlock record, but the Golden Crown is
 * awarded as a badge and used to have no item row. A revoked crown badge (a
 * withdrawal out of Gold) must not re-lock the item: items stay once earned.
 * Any historical crown badge row therefore counts as ownership.
 */

import type { ItemKey } from './items'

type BadgeRow = {
  badge_key: string
  revoked_at?: string | null
}

export function ownedItemKeys(items: readonly string[], badges: readonly BadgeRow[]): ItemKey[] {
  const owned = new Set(items as ItemKey[])
  if (badges.some((badge) => badge.badge_key === 'golden_crown')) {
    owned.add('golden_crown')
  }
  return [...owned]
}
