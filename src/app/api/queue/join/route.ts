/**
 * POST /api/queue/join
 *
 * Enter the ranked matchmaking queue (spec 10.1/10.3). Eligibility, re-checked
 * server-side on every join:
 *   - Level >= 3 AND at least 5 check-ins
 *   - A bracket (balance >= 1 NIM) — the bracket can change while waiting;
 *     match_me re-checks it at match time.
 *   - Fewer than 3 battles started today
 *   - No open battle right now
 * Re-joining while already queued refreshes the existing row (upsert) rather
 * than erroring, so a client that re-renders doesn't break.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { RANKED, BATTLE, type Bracket } from '@/lib/constants'
import { utcDayOf } from '@/lib/game/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data: p } = await db.from('players').select('*').eq('address', address).maybeSingle()
  if (!p) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  if (p.level < RANKED.minLevel || p.check_in_count < RANKED.minCheckIns) {
    return NextResponse.json(
      {
        error: `Reach Level ${RANKED.minLevel} and complete ${RANKED.minCheckIns} check-ins to unlock ranked battles.`,
      },
      { status: 403 },
    )
  }
  if (!p.bracket) {
    return NextResponse.json(
      { error: 'You need at least 1 NIM in your savings account to enter ranked.' },
      { status: 403 },
    )
  }

  const today = utcDayOf(new Date())
  const { data: limitRow } = await db
    .from('daily_battles')
    .select('count')
    .eq('player_address', address)
    .eq('utc_date', today)
    .maybeSingle()
  if ((limitRow?.count ?? 0) >= BATTLE.dailyLimit) {
    return NextResponse.json(
      {
        error: `You've started ${BATTLE.dailyLimit} battles today. New battles unlock at 00:00 UTC (1:00 AM Lagos time).`,
      },
      { status: 429 },
    )
  }

  const { data: busy } = await db
    .from('battles')
    .select('id')
    .in('status', ['pending', 'active'])
    .or(`player_a.eq.${address},player_b.eq.${address}`)
    .limit(1)
  if (busy && busy.length > 0) {
    return NextResponse.json({ error: 'You already have a battle open.' }, { status: 409 })
  }

  const now = new Date()
  const { error } = await db.from('queue').upsert({
    player_address: address,
    bracket: p.bracket as Bracket,
    rating: p.rating,
    entered_at: now.toISOString(),
    last_poll_at: now.toISOString(),
    status: 'waiting',
    battle_id: null,
  }, { onConflict: 'player_address' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, waiting: true }, { status: 201 })
}
