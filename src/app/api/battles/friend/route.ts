/**
 * POST /api/battles/friend
 *
 * Create an unranked friend challenge (spec 9.3). The battle row starts as
 * `pending` with no player_b; the challenged player claims it via the join
 * route. Counts toward the creator's daily limit at creation time — starting
 * the challenge is "starting a battle" for Quick Duel purposes.
 * Unanswered challenges expire after 24 hours (handled in loadBattle).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { startBattle } from '@/lib/game/battleServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const result = await startBattle(db, address, 'unranked', new Date())
  if (!result.ok) {
    const status = result.code === 'limit' ? 429 : result.code === 'busy' ? 409 : 500
    const message =
      result.code === 'limit'
        ? "You've started 3 battles today. New battles unlock at 00:00 UTC (1:00 AM Lagos time)."
        : result.error
    return NextResponse.json({ error: message }, { status })
  }

  // Share link: inside Nimiq Pay the path routes directly; externally the
  // nimpay.app open-link wrapper carries the full path.
  const origin = new URL(req.url).origin
  return NextResponse.json(
    {
      battleId: result.battleId,
      sharePath: `/battle/${result.battleId}`,
      shareUrl: `${origin}/battle/${result.battleId}`,
      deeplink: `nimiqpay://miniapp?url=${encodeURIComponent(`${origin}/battle/${result.battleId}`)}`,
    },
    { status: 201 },
  )
}
