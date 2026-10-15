/**
 * POST /api/battles/ai
 *
 * Start a battle against the Savborne AI (spec 9.3, 11). Unranked, counts
 * toward the 3-battle daily limit, resolves instantly per turn.
 * Returns the freshly created battle id; the client navigates to /battle/[id].
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
  const result = await startBattle(db, address, 'ai', new Date())
  if (!result.ok) {
    const status = result.code === 'limit' ? 429 : result.code === 'busy' ? 409 : 500
    const message =
      result.code === 'limit'
        ? "You've started 3 battles today. New battles unlock at 00:00 UTC (1:00 AM Lagos time)."
        : result.error
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ battleId: result.battleId }, { status: 201 })
}
