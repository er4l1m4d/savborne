/**
 * POST /api/battles/[id]/cancel
 *
 * Abandon an unanswered friend challenge. Only the creator may cancel, and
 * only while the battle is pending with no opponent. The 24-hour expiry in
 * loadBattle remains the fallback for a creator who never returns.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }
  const { id } = await ctx.params
  const db = supabaseAdmin()

  const { data: battle, error } = await db
    .from('battles')
    .select('id, player_a, player_b, status')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!battle) return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
  if (battle.player_a !== address) {
    return NextResponse.json({ error: 'Only the challenger can cancel' }, { status: 403 })
  }
  if (battle.status !== 'pending' || battle.player_b !== null) {
    return NextResponse.json({ error: 'Challenge already accepted or closed' }, { status: 409 })
  }

  const { data: updated, error: updateErr } = await db
    .from('battles')
    .update({ status: 'abandoned' })
    .eq('id', id)
    .eq('status', 'pending')
    .is('player_b', null)
    .select('id')
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Challenge was just accepted' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
