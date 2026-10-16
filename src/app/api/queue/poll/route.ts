/**
 * POST /api/queue/poll
 *
 * The client calls this every 10 s while searching. Each poll attempts a
 * match through the atomic `match_me()` Postgres function (bracket re-check,
 * rating window widened by wait, FOR UPDATE SKIP LOCKED, stale cleanup —
 * all verified by the queue stress test). No background worker needed, which
 * is what the Vercel Hobby cron limit forced us to design around.
 *
 * Response:
 *   matched: { matched: true, battleId }        — go to /battle/[id]
 *   waiting: { matched: false, waitedSeconds, range }
 *   left:    { matched: false, left: true }     — row gone (cancelled/stale)
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { RANKED } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const now = new Date()

  // Attempt pairing (returns battle uuid or null).
  const { data: battleId, error: matchErr } = await db.rpc('match_me', { me_address: address })
  if (matchErr) {
    return NextResponse.json({ error: matchErr.message }, { status: 500 })
  }
  if (battleId) {
    return NextResponse.json({ matched: true, battleId })
  }

  // No fresh pair. Maybe THIS player was matched by the opponent's poll —
  // the queue row then carries status 'matched' with a battle_id.
  const { data: row, error } = await db
    .from('queue')
    .select('status, battle_id, entered_at')
    .eq('player_address', address)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ matched: false, left: true })
  if (row.status === 'matched' && row.battle_id) {
    return NextResponse.json({ matched: true, battleId: row.battle_id })
  }
  if (row.status === 'cancelled') {
    return NextResponse.json({ matched: false, left: true })
  }

  // Still waiting: compute the current rating window for the UI copy.
  const waitedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(row.entered_at).getTime()) / 1000),
  )
  const range =
    RANKED.matchRangeByWaitSeconds.find((w) => waitedSeconds < w.underSeconds)?.range ?? 600

  return NextResponse.json({ matched: false, waitedSeconds, range })
}
