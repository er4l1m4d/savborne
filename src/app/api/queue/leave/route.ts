/**
 * POST /api/queue/leave
 *
 * Drop out of the ranked queue. Always allowed — including when already
 * matched-but-not-yet-loaded (the client navigates away). Deleting the row
 * is cleaner than a 'cancelled' status: the queue table stays small and the
 * unique player_address PK is immediately reusable for the next join.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { routeError } from '@/lib/report'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address

  const db = supabaseAdmin()
  // Only leave while unmatched; a matched battle is the opponent's commitment
  // and is handled by the battle flow (Defend-on-timeout rules), not here.
  const { error } = await db
    .from('queue')
    .delete()
    .eq('player_address', address)
    .neq('status', 'matched')
  if (error) {
    return routeError({ req, route: '/api/queue/leave', code: 'db_error', status: 500, error })
  }

  return NextResponse.json({ ok: true })
}
