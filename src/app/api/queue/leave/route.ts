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
import { PLAYER_HEADER } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  // Only leave while unmatched; a matched battle is the opponent's commitment
  // and is handled by the battle flow (Defend-on-timeout rules), not here.
  const { error } = await db
    .from('queue')
    .delete()
    .eq('player_address', address)
    .neq('status', 'matched')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
