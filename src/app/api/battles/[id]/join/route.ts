/**
 * POST /api/battles/[id]/join
 *
 * Claim a pending friend challenge as player_b (spec 9.3). Only works while
 * the battle is `pending` with no opponent and the joiner is not the
 * creator. On success the battle flips to `active` and turn 1 begins.
 *
 * The joiner does NOT consume their own daily battle count for joining —
 * only the starter does — but they DO receive battle XP on completion.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const address = _req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }
  const { id } = await ctx.params
  const db = supabaseAdmin()

  const { data: battle, error } = await db
    .from('battles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })

  if (battle.status !== 'pending' || battle.player_b !== null) {
    return NextResponse.json({ error: 'Challenge already accepted or closed' }, { status: 409 })
  }
  if (battle.player_a === address) {
    return NextResponse.json({ error: 'You created this challenge' }, { status: 400 })
  }

  // Claim the seat only — do NOT flip to active. beginBattleIfDue (run by the
  // next loadBattle) is the single place a battle starts, so both players'
  // daily counters and Quick Duel credit exactly once through it.
  const { error: updErr } = await db
    .from('battles')
    .update({ player_b: address })
    .eq('id', id)
    .eq('status', 'pending')
    .is('player_b', null) // atomic guard against a double-join race
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Verify we were the one who claimed it (someone else may have raced us).
  const { data: fresh } = await db.from('battles').select('player_b').eq('id', id).single()
  if (fresh?.player_b !== address) {
    return NextResponse.json({ error: 'Challenge was just accepted by someone else' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, battleId: id })
}
