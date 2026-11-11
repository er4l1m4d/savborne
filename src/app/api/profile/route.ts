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
import type { Bracket } from '@/lib/constants'
import type { BadgeKey } from '@/lib/game/badges'
import { ownedItemKeys } from '@/lib/game/owned-items'
import { routeError } from '@/lib/report'
import { rateLimitOrError } from '@/lib/rate-limit'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address
  const limited = await rateLimitOrError({
    req,
    route: '/api/profile',
    key: `profile:${address}`,
    limit: 120,
    windowSeconds: 60,
  })
  if (limited) return limited


  const db = supabaseAdmin()
  const [{ data: player, error: playerErr }, { data: items }, { data: badges }, { data: vault }] =
    await Promise.all([
      db.from('players').select('*').eq('address', address).maybeSingle(),
      db.from('player_items').select('item_key').eq('player_address', address),
      db
        .from('player_badges')
        .select('badge_key, revoked_at')
        .eq('player_address', address),
      db.from('vaults').select('card_token').eq('player_address', address).maybeSingle(),
    ])

  if (playerErr) {
    return routeError({
      req, route: '/api/profile', code: 'db_error', status: 500, error: playerErr,
    })
  }
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  return NextResponse.json({
    player: {
      address: player.address,
      displayName: player.display_name,
      avatar: player.avatar,
      level: player.level,
      xp: player.xp,
      rating: player.rating,
      bracket: (player.bracket as Bracket | null) ?? null,
      balanceLuna: Number(player.current_balance_luna),
      streakCurrent: player.streak_current,
      streakBest: player.streak_best,
      shields: player.shields,
      shieldsEarned: player.shields_earned,
      checkInCount: player.check_in_count,
      wins: player.wins,
      losses: player.losses,
      ties: player.ties,
    },
    ownedItems: ownedItemKeys(
      (items ?? []).map((r) => r.item_key),
      badges ?? [],
    ),
    activeBadges: (badges ?? [])
      .filter((r) => !r.revoked_at)
      .map((r) => r.badge_key as BadgeKey),
    cardToken: (vault?.card_token as string | undefined) ?? null,
  })
}
