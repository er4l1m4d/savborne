/**
 * POST /api/battles/[id]/move
 *
 * Submit the viewer's move for the current turn. Body:
 *   { move: 'attack' | 'defend' | 'special' | 'item', itemKey?: string }
 *
 * AI battles resolve immediately (the AI move is generated + resolved in the
 * same call). Human battles resolve once BOTH sides have submitted; this call
 * may therefore just record the move and return "waiting" state. The client
 * keeps polling GET /api/battles/[id] either way — this route returns the
 * same shape as GET so an immediate-update render is free.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { submitMove } from '@/lib/game/battleServer'
import type { BattleMove } from '@/lib/game/battle'
import type { ItemKey } from '@/lib/game/items'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'
import { rateLimitOrError } from '@/lib/rate-limit'

const VALID_MOVES = new Set(['attack', 'defend', 'special', 'item'])

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address
  const limited = await rateLimitOrError({
    req,
    route: '/api/battles/[id]/move',
    key: `battle-move:${address}`,
    limit: 30,
    windowSeconds: 60,
  })
  if (limited) return limited

  const { id } = await ctx.params

  let body: { move?: unknown; itemKey?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.move !== 'string' || !VALID_MOVES.has(body.move)) {
    return NextResponse.json({ error: 'move must be attack/defend/special/item' }, { status: 400 })
  }
  const itemKey =
    body.move === 'item' && typeof body.itemKey === 'string' ? (body.itemKey as ItemKey) : null
  if (body.move === 'item' && !itemKey) {
    return NextResponse.json({ error: 'item move requires itemKey' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const result = await submitMove(db, id, address, body.move as BattleMove, itemKey, new Date())
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // Light-weight echo of the new state; the screen refreshes via its poll loop.
  const { battle } = result.view
  return NextResponse.json({
    ok: true,
    status: battle.status,
    currentTurn: battle.current_turn,
    hpA: battle.player_a_hp,
    hpB: battle.player_b_hp,
    winner: battle.winner,
  })
}
