/**
 * GET /api/profile
 *
 * Returns everything the Profile tab needs in one round-trip: player header
 * stats, the list of unlocked item keys, and the list of active badge keys
 * (badges whose `revoked_at IS NULL`). Address is taken from the
 * X-Player-Address header, same pattern as every other authenticated route.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import type { Bracket } from '@/lib/constants'
import type { ItemKey } from '@/lib/game/items'
import type { BadgeKey } from '@/lib/game/badges'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const [{ data: player, error: playerErr }, { data: items }, { data: badges }] =
    await Promise.all([
      db.from('players').select('*').eq('address', address).maybeSingle(),
      db.from('player_items').select('item_key').eq('player_address', address),
      db
        .from('player_badges')
        .select('badge_key')
        .eq('player_address', address)
        .is('revoked_at', null),
    ])

  if (playerErr) {
    return NextResponse.json({ error: playerErr.message }, { status: 500 })
  }
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  return NextResponse.json({
    player: {
      address: player.address,
      displayName: player.display_name,
      level: player.level,
      xp: player.xp,
      rating: player.rating,
      bracket: (player.bracket as Bracket | null) ?? null,
      balanceLuna: Number(player.current_balance_luna),
      streakCurrent: player.streak_current,
      streakBest: player.streak_best,
      checkInCount: player.check_in_count,
      wins: player.wins,
      losses: player.losses,
      ties: player.ties,
    },
    ownedItems: (items ?? []).map((r) => r.item_key as ItemKey),
    activeBadges: (badges ?? []).map((r) => r.badge_key as BadgeKey),
  })
}
