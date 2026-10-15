/**
 * GET /api/battles/[id]
 *
 * Poll the current battle state (the client hits this every 3 seconds during
 * an active battle). Runs timeout defaulting as a side effect when the turn
 * deadline has passed (spec 9.5: no move chosen → Defend), so resolution
 * never waits on a background worker — the next poll drives it.
 *
 * Response shape is what the battle screen renders directly:
 *   {
 *     battle: { id, mode, status, currentTurn, turnDeadline, hpA, hpB,
 *               winnerName, loserName, participants }
 *     viewer: { side, hasMovedThisTurn, specialAvailable, activeItems,
 *               ownedInactiveItems, opponentLastMove }
 *     lastTurn: { turnNumber, a: {move, damage}, b: {move, damage} } | null
 *   }
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { loadBattle, AI_ADDRESS } from '@/lib/game/battleServer'
import { modsForItems, specialAvailable, type BattleMove } from '@/lib/game/battle'
import { ITEMS, type ItemKey } from '@/lib/game/items'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }
  const { id } = await ctx.params
  const db = supabaseAdmin()
  const now = new Date()

  const loaded = await loadBattle(db, id, address, now)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const { battle, moves, opponentAddress } = loaded

  const side: 'a' | 'b' = battle.player_a === address ? 'a' : 'b'
  const turn = battle.current_turn

  // Viewer context for the move buttons.
  const hasMovedThisTurn = moves.some(
    (m) => m.player_address === address && m.turn_number === turn,
  )
  const activeItems = moves
    .filter((m) => m.player_address === address && m.move_type === 'item' && m.item_key)
    .map((m) => m.item_key as ItemKey)
  const mods = modsForItems(activeItems)
  const lastOwn = moves.find(
    (m) => m.player_address === address && m.turn_number === turn - 1,
  )
  const canSpecial = specialAvailable(lastOwn ? (lastOwn.move_type as BattleMove) : null, mods)

  const { data: ownedRows } = await db
    .from('player_items')
    .select('item_key')
    .eq('player_address', address)
  const owned = new Set((ownedRows ?? []).map((r) => r.item_key as ItemKey))
  const ownedInactiveItems = ITEMS.filter(
    (i) => !i.isBadge && owned.has(i.key) && !activeItems.includes(i.key),
  ).map((i) => i.key)

  // Copper Compass: reveal the opponent's previous move only if the viewer
  // owns it (spec Section 7).
  let opponentLastMove: string | null = null
  if (mods.revealsLastMove && opponentAddress) {
    const oppLast = moves.find(
      (m) => m.player_address === opponentAddress && m.turn_number === turn - 1,
    )
    opponentLastMove = oppLast ? oppLast.move_type : null
  }

  // Names for display (addresses never shown to other players).
  const { data: names } = await db
    .from('players')
    .select('address, display_name')
    .in('address', [battle.player_a, battle.player_b ?? battle.player_a])
  const nameOf = (a: string | null) =>
    a === AI_ADDRESS ? 'Savborne AI' : names?.find((n) => n.address === a)?.display_name ?? '—'

  // Last-resolved turn summary.
  const resolvedTurns = [...new Set(moves.filter((m) => m.resolved_damage > 0).map((m) => m.turn_number))]
  const lastTurnNumber = resolvedTurns.length > 0 ? Math.max(...resolvedTurns) : turn - 1
  const lastTurnMoves = moves.filter((m) => m.turn_number === lastTurnNumber)
  const lastTurn =
    lastTurnNumber >= 1 && lastTurnMoves.length > 0
      ? {
          turnNumber: lastTurnNumber,
          a: summarise(lastTurnMoves.find((m) => m.player_address === battle.player_a)),
          b: summarise(
            lastTurnMoves.find((m) =>
              battle.mode === 'ai'
                ? m.player_address === AI_ADDRESS
                : m.player_address === battle.player_b,
            ),
          ),
        }
      : null

  return NextResponse.json({
    battle: {
      id: battle.id,
      mode: battle.mode,
      status: battle.status,
      currentTurn: battle.current_turn,
      turnDeadline: battle.turn_deadline,
      hpA: battle.player_a_hp,
      hpB: battle.player_b_hp,
      winner: battle.winner,
      winnerName: battle.winner ? nameOf(battle.winner) : null,
      createdAt: battle.created_at,
      opponentAddress,
      opponentName: nameOf(opponentAddress),
      maxTurns: 5,
      startingHp: 100,
    },
    viewer: {
      side,
      address,
      displayName: nameOf(address),
      hasMovedThisTurn,
      specialAvailable: canSpecial,
      activeItems,
      ownedInactiveItems,
      opponentLastMove,
    },
    lastTurn,
  })
}

function summarise(m?: { move_type: string; item_key: string | null; resolved_damage: number }) {
  if (!m) return null
  return { move: m.move_type, itemKey: m.item_key, damage: m.resolved_damage }
}
