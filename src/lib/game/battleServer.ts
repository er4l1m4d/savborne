/**
 * Savborne — Battle orchestration (server-only)
 *
 * The transactional heart of battles: start (with daily-limit enforcement),
 * submit-and-resolve, timeout defaulting, and settlement (XP, missions,
 * badges, W/L record). API routes are thin wrappers over these functions so
 * the rules live in exactly one place.
 *
 * Item model decision (documented, spec-adjacent): owned items start
 * INACTIVE in battle; activating one costs your turn action ("Use item",
 * spec 9.2) and the effect then persists for the rest of the battle. The AI
 * activates its loadout before turn 1 per spec 11.2 (no turn cost, because
 * it is "at the start of the battle").
 *
 * Settlement is a sequence of service-role writes rather than a single SQL
 * transaction. If a write fails mid-settlement the row logs and the next
 * poll re-drives it (settle is idempotent for battles already completed).
 * A Postgres function version is a Phase 6 hardening candidate.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BATTLE, XP_VALUES, eloDelta, type Bracket } from '../constants'
import {
  aiChooseMove,
  aiStartingItems,
  checkBattleOver,
  modsForItems,
  resolveTurn,
  specialAvailable,
  battleXp,
  type BattleMove,
} from './battle'
import type { ItemKey } from './items'
import { evaluateForBattle, type CompletedMission } from './missions'
import { settleMissions, awardRawXp, settleBadges } from './settle'
import { utcDayOf, utcWeekStart } from './time'

export const AI_ADDRESS = 'ai-savborne'

export type BattleRow = {
  id: string
  mode: 'ranked' | 'unranked' | 'ai'
  status: 'pending' | 'active' | 'completed' | 'abandoned'
  player_a: string
  player_b: string | null
  current_turn: number
  turn_deadline: string | null
  player_a_hp: number
  player_b_hp: number
  winner: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export type MoveRow = {
  player_address: string
  turn_number: number
  move_type: BattleMove
  item_key: string | null
  resolved_damage: number
}

// ─── Start ──────────────────────────────────────────────────────────────────

export type StartResult =
  | { ok: true; battleId: string }
  | { ok: false; error: string; code: 'limit' | 'busy' | 'unknown' }

/**
 * Create a battle of `mode` for `address`. Enforces:
 * - Daily limit of 3 STARTED battles across all modes (spec 9.4).
 * - One open battle at a time per player (busy guard).
 *
 * The battle is created as `pending` for EVERY mode. Counting (daily_battles
 * + Quick Duel) happens exactly once, per human, when the battle flips to
 * `active` in beginBattleIfDue — for AI immediately on the first poll, for
 * friend challenges when both sides are present, for ranked when match_me
 * pairs the queue. A challenge nobody accepts therefore never consumes the
 * creator's daily allowance.
 */
export async function startBattle(
  db: SupabaseClient,
  address: string,
  mode: 'unranked' | 'ai',
  now: Date,
): Promise<StartResult> {
  const today = utcDayOf(now)
  const { data: limitRow } = await db
    .from('daily_battles')
    .select('count')
    .eq('player_address', address)
    .eq('utc_date', today)
    .maybeSingle()
  if ((limitRow?.count ?? 0) >= BATTLE.dailyLimit) {
    return { ok: false, code: 'limit', error: 'Daily battle limit reached' }
  }

  const { data: busy } = await db
    .from('battles')
    .select('id')
    .in('status', ['pending', 'active'])
    .or(`player_a.eq.${address},player_b.eq.${address}`)
    .limit(1)
  if (busy && busy.length > 0) {
    return { ok: false, code: 'busy', error: 'You already have a battle open' }
  }

  const playerB = mode === 'ai' ? AI_ADDRESS : null
  const { data: battle, error } = await db
    .from('battles')
    .insert({
      mode,
      status: 'pending',
      player_a: address,
      player_b: playerB,
      current_turn: 1,
      turn_deadline: null,
      player_a_hp: BATTLE.startingHp,
      player_b_hp: BATTLE.startingHp,
      started_at: null,
    })
    .select()
    .single()
  if (error || !battle) {
    console.error('startBattle insert failed:', error?.message)
    return { ok: false, code: 'unknown', error: error?.message ?? 'Insert failed' }
  }

  return { ok: true, battleId: battle.id }
}

/**
 * Flip a due `pending` battle to `active` exactly once (guarded update —
 * concurrent callers lose the race silently). On a won flip, each human
 * participant gets their daily_battles increment and, if it is their first
 * battle of the UTC day, the Quick Duel mission credit.
 * Returns true when THIS call performed the flip.
 */
export async function beginBattleIfDue(
  db: SupabaseClient,
  battle: BattleRow,
  now: Date,
): Promise<boolean> {
  if (battle.status !== 'pending') return false
  const readyToStart = battle.mode === 'ai' || battle.player_b !== null
  if (!readyToStart) return false

  const { data: flipped } = await db
    .from('battles')
    .update({
      status: 'active',
      started_at: now.toISOString(),
      turn_deadline: new Date(now.getTime() + BATTLE.turnTimerSeconds * 1000).toISOString(),
      current_turn: Math.max(1, battle.current_turn),
    })
    .eq('id', battle.id)
    .eq('status', 'pending')
    .select('id')
  if (!flipped || flipped.length === 0) return false // another caller won the flip

  const day = utcDayOf(now)
  for (const addr of [battle.player_a, battle.player_b]) {
    if (!addr || addr === AI_ADDRESS) continue
    const countBefore = await incrementDailyBattles(db, addr, day)
    if (countBefore === 0) await creditQuickDuel(db, addr, now)
  }
  return true
}

// ─── Load / poll ────────────────────────────────────────────────────────────

export type BattleView = {
  battle: BattleRow
  moves: MoveRow[]
  opponentAddress: string | null
}

/** Read battle + all moves. Runs timeout defaulting first when due. */
export async function loadBattle(
  db: SupabaseClient,
  battleId: string,
  viewerAddress: string,
  now: Date,
): Promise<BattleView | { error: string; status: number }> {
  const { data: battle, error } = await db.from('battles').select('*').eq('id', battleId).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!battle) return { error: 'Battle not found', status: 404 }
  const row = battle as BattleRow
  // Participant check. The challenged side of a still-pending friend battle
  // is allowed so they can view it and accept; once an opponent is set,
  // only the two actual participants may access this battle.
  const isParticipant =
    row.player_a === viewerAddress ||
    row.player_b === viewerAddress ||
    (row.status === 'pending' && row.player_b === null)
  if (!isParticipant) {
    return { error: 'Not your battle', status: 403 }
  }

  // Friend challenge expiry: pending + older than 24h → abandoned (spec 9.5).
  if (row.status === 'pending' && row.player_b === null) {
    const ageMs = now.getTime() - new Date(row.created_at).getTime()
    if (ageMs > BATTLE.challengeExpiryHours * 3_600_000) {
      await db.from('battles').update({ status: 'abandoned' }).eq('id', row.id)
      row.status = 'abandoned'
    }
  }

  // Start a due pending battle (counts dailies exactly once). When we even
  // ATTEMPTED the flip, always re-read: a concurrent caller may have won the
  // race, and we must not hand back a stale 'pending' row. Then run turn
  // timeout defaulting (spec 9.5).
  let current = row
  const attemptedBegin = current.status === 'pending'
  await beginBattleIfDue(db, current, now)
  const dueForTimeout =
    current.status === 'active' &&
    current.turn_deadline !== null &&
    new Date(current.turn_deadline) < now
  if (attemptedBegin || dueForTimeout) {
    if (dueForTimeout) await timeoutResolveTurn(db, current, now)
    const { data: fresh } = await db.from('battles').select('*').eq('id', battleId).single()
    current = fresh as BattleRow
  }

  const { data: moves } = await db
    .from('battle_moves')
    .select('player_address, turn_number, move_type, item_key, resolved_damage')
    .eq('battle_id', battleId)
    .order('turn_number', { ascending: true })

  const opponentAddress =
    current.player_a === viewerAddress ? current.player_b : current.player_a
  return { battle: current, moves: (moves ?? []) as MoveRow[], opponentAddress }
}

// ─── Submit a move ──────────────────────────────────────────────────────────

export type SubmitResult =
  | { ok: true; view: BattleView }
  | { ok: false; error: string; status: number }

/**
 * Persist the viewer's move for the current turn. For AI battles the AI's
 * move is chosen and the turn resolved immediately. For human battles the
 * turn resolves when both sides have submitted.
 */
export async function submitMove(
  db: SupabaseClient,
  battleId: string,
  viewerAddress: string,
  move: BattleMove,
  itemKey: ItemKey | null,
  now: Date,
): Promise<SubmitResult> {
  const loaded = await loadBattle(db, battleId, viewerAddress, now)
  if ('error' in loaded) return { ok: false, error: loaded.error, status: loaded.status }
  const { battle, moves } = loaded

  if (battle.status !== 'active') {
    return { ok: false, error: `Battle is ${battle.status}`, status: 409 }
  }
  const side: 'a' | 'b' = battle.player_a === viewerAddress ? 'a' : 'b'
  const turn = battle.current_turn

  const already = moves.some(
    (m) => m.player_address === viewerAddress && m.turn_number === turn,
  )
  if (already) return { ok: false, error: 'Move already submitted for this turn', status: 409 }

  // Validate special cooldown.
  if (move === 'special') {
    const viewerMods = modsForItems(await activeItemsFor(db, battleId, viewerAddress))
    const lastOwn = lastMoveOf(moves, viewerAddress, turn - 1)
    if (!specialAvailable(lastOwn, viewerMods)) {
      return { ok: false, error: 'Special Move is on cooldown', status: 400 }
    }
  }
  // Validate item activation.
  if (move === 'item') {
    if (!itemKey) return { ok: false, error: 'item move requires item_key', status: 400 }
    const { data: owned } = await db
      .from('player_items')
      .select('item_key')
      .eq('player_address', viewerAddress)
      .eq('item_key', itemKey)
      .maybeSingle()
    if (!owned) return { ok: false, error: 'You do not own that item', status: 400 }
    const used = moves.some(
      (m) => m.player_address === viewerAddress && m.move_type === 'item' && m.item_key === itemKey,
    )
    if (used) return { ok: false, error: 'Item already used this battle', status: 409 }
  }

  await db.from('battle_moves').insert({
    battle_id: battleId,
    player_address: viewerAddress,
    turn_number: turn,
    move_type: move,
    item_key: move === 'item' ? itemKey : null,
  })

  // Re-load moves after the insert.
  const { data: allMoves } = await db
    .from('battle_moves')
    .select('player_address, turn_number, move_type, item_key, resolved_damage')
    .eq('battle_id', battleId)
    .order('turn_number', { ascending: true })
  let movesNow = (allMoves ?? []) as MoveRow[]

  if (battle.mode === 'ai') {
    // AI chooses and the turn always resolves on the player's submit.
    const aiMove = chooseAiMove(battle, movesNow, viewerAddress, turn)
    await db.from('battle_moves').insert({
      battle_id: battleId,
      player_address: AI_ADDRESS,
      turn_number: turn,
      move_type: aiMove,
      item_key: null,
    })
    movesNow = [
      ...movesNow,
      { player_address: AI_ADDRESS, turn_number: turn, move_type: aiMove, item_key: null, resolved_damage: 0 },
    ]
    await resolveAndAdvance(db, battle, movesNow, viewerAddress, turn, now)
  } else {
    const opponent = side === 'a' ? battle.player_b : battle.player_a
    const opponentMoved = opponent
      ? movesNow.some((m) => m.player_address === opponent && m.turn_number === turn)
      : false
    if (opponentMoved && opponent) {
      await resolveAndAdvance(db, battle, movesNow, viewerAddress, turn, now)
    }
  }

  const refreshed = await loadBattle(db, battleId, viewerAddress, now)
  if ('error' in refreshed) return { ok: false, error: refreshed.error, status: 500 }
  return { ok: true, view: refreshed }
}

// ─── Turn resolution ────────────────────────────────────────────────────────

async function resolveAndAdvance(
  db: SupabaseClient,
  battle: BattleRow,
  moves: MoveRow[],
  viewerAddress: string,
  turn: number,
  now: Date,
) {
  const aMove = moves.find((m) => m.player_address === battle.player_a && m.turn_number === turn)
  const bMove = battle.player_b
    ? moves.find((m) => m.player_address === battle.player_b && m.turn_number === turn)
    : undefined
  if (!aMove || (battle.mode !== 'ai' && !bMove)) return

  const bMoveFinal: MoveRow = bMove ?? {
    // AI battle with a missing AI row shouldn't happen (we insert it first);
    // default to defend as a safety net.
    player_address: battle.player_b ?? AI_ADDRESS,
    turn_number: turn,
    move_type: 'defend',
    item_key: null,
    resolved_damage: 0,
  }

  const aItems = activeItemsFromMoves(moves, battle.player_a)
  const bItems =
    battle.mode === 'ai'
      ? aiStartingItems(await playerReachedBronze(db, viewerAddress))
      : activeItemsFromMoves(moves, battle.player_b ?? '')

  const outcome = resolveTurn(
    { move: aMove.move_type, mods: modsForItems(aItems) },
    { move: bMoveFinal.move_type, mods: modsForItems(bItems) },
  )

  // Stamp resolved damage onto each move row (update if exists else insert).
  await db
    .from('battle_moves')
    .update({ resolved_damage: outcome.damageToB })
    .eq('battle_id', battle.id)
    .eq('player_address', battle.player_a)
    .eq('turn_number', turn)
  await db
    .from('battle_moves')
    .update({ resolved_damage: outcome.damageToA })
    .eq('battle_id', battle.id)
    .eq('player_address', bMoveFinal.player_address)
    .eq('turn_number', turn)

  // Each side loses the damage the OPPONENT dealt it:
  // damageToA = dealt by B → subtract from A's hp (and vice versa).
  const hpA = Math.max(0, battle.player_a_hp - outcome.damageToA)
  const hpB = Math.max(0, battle.player_b_hp - outcome.damageToB)
  const over = checkBattleOver(hpA, hpB, turn)

  if (over.over) {
    const winnerAddress =
      over.winner === 'tie' || !over.winner
        ? null
        : over.winner === 'a'
          ? battle.player_a
          : battle.player_b
    await db
      .from('battles')
      .update({
        player_a_hp: hpA,
        player_b_hp: hpB,
        status: 'completed',
        winner: winnerAddress,
        current_turn: turn,
        turn_deadline: null,
        completed_at: now.toISOString(),
      })
      .eq('id', battle.id)
    await settleBattle(db, battle, winnerAddress, viewerAddress, now)
    return
  }

  await db
    .from('battles')
    .update({
      player_a_hp: hpA,
      player_b_hp: hpB,
      current_turn: turn + 1,
      turn_deadline: new Date(now.getTime() + BATTLE.turnTimerSeconds * 1000).toISOString(),
      status: 'active',
    })
    .eq('id', battle.id)
}

/** Fill missing moves with Defend for a due turn, then resolve it. */
async function timeoutResolveTurn(db: SupabaseClient, battle: BattleRow, now: Date) {
  const turn = battle.current_turn
  const { data: movesRaw } = await db
    .from('battle_moves')
    .select('player_address, turn_number, move_type, item_key, resolved_damage')
    .eq('battle_id', battle.id)
    .order('turn_number', { ascending: true })
  const moves = (movesRaw ?? []) as MoveRow[]

  const fill = async (address: string) => {
    const has = moves.some((m) => m.player_address === address && m.turn_number === turn)
    if (has) return
    await db.from('battle_moves').insert({
      battle_id: battle.id,
      player_address: address,
      turn_number: turn,
      move_type: 'defend',
      item_key: null,
    })
    moves.push({ player_address: address, turn_number: turn, move_type: 'defend', item_key: null, resolved_damage: 0 })
  }

  await fill(battle.player_a)
  if (battle.player_b && battle.mode !== 'ai') await fill(battle.player_b)
  if (battle.mode === 'ai') {
    // AI never times out; ensure it has a row via its strategy.
    await fill(AI_ADDRESS)
  }

  const viewer = battle.player_a // any participant works for resolution
  await resolveAndAdvance(db, battle, moves, viewer, turn, now)
}

// ─── Settlement ─────────────────────────────────────────────────────────────

async function settleBattle(
  db: SupabaseClient,
  battle: BattleRow,
  winnerAddress: string | null,
  viewerAddress: string,
  now: Date,
) {
  const winnerSide: 'a' | 'b' | 'tie' =
    winnerAddress === null ? 'tie' : winnerAddress === battle.player_a ? 'a' : 'b'
  const participants = [battle.player_a, battle.player_b].filter(
    (p): p is string => !!p && p !== AI_ADDRESS,
  )
  // Elo applies to RANKED human-vs-human battles only (spec 10.2). Compute
  // both deltas from pre-battle ratings before writing either.
  const addressRow = new Map<string, { rating: number }>()
  if (battle.mode === 'ranked' && participants.length === 2) {
    const { data: preRows } = await db
      .from('players')
      .select('address, rating')
      .in('address', participants)
    for (const r of preRows ?? []) addressRow.set(r.address, { rating: r.rating })
  }
  for (const address of participants) {
    const { data: p } = await db.from('players').select('*').eq('address', address).single()
    if (!p) continue
    const perspective: 'a' | 'b' = address === battle.player_a ? 'a' : 'b'
    const outcome: 'win' | 'loss' | 'tie' =
      winnerSide === 'tie' ? 'tie' : winnerSide === perspective ? 'win' : 'loss'

    // Battle XP is uncapped raw XP (spec 9.6).
    const xp = battleXp(winnerSide, perspective)
    await awardRawXp(db, address, { xp: p.xp, level: p.level }, xp)

    // Elo rating change (ranked only).
    if (battle.mode === 'ranked') {
      const own = addressRow.get(address)?.rating ?? p.rating
      const oppAddr = participants.find((x) => x !== address)
      const opp = oppAddr ? (addressRow.get(oppAddr)?.rating ?? 1000) : 1000
      const resultNum = outcome === 'win' ? 1 : outcome === 'tie' ? 0.5 : 0
      const delta = eloDelta(own, opp, resultNum)
      const { error: eloErr } = await db
        .from('players')
        .update({ rating: own + delta })
        .eq('address', address)
      if (eloErr) console.error('settleBattle: elo update failed:', eloErr.message)
    }

    // W/L/T record.
    const update =
      outcome === 'win'
        ? { wins: p.wins + 1 }
        : outcome === 'loss'
          ? { losses: p.losses + 1 }
          : { ties: p.ties + 1 }
    await db.from('players').update(update).eq('address', address)

    // Battle missions.
    const { data: ownMoves } = await db
      .from('battle_moves')
      .select('move_type')
      .eq('battle_id', battle.id)
      .eq('player_address', address)
    const moveSet = new Set((ownMoves ?? []).map((m) => m.move_type))
    const weekStart = utcWeekStart(now)
    const { count: weeklyWinsBefore } = await db
      .from('battles')
      .select('id', { count: 'exact', head: true })
      .eq('winner', address)
      .in('mode', ['ranked', 'unranked', 'ai'])
      .gte('completed_at', weekStart.toISOString())
      .lt('completed_at', now.toISOString())
    const { data: todayRow } = await db
      .from('daily_battles')
      .select('count')
      .eq('player_address', address)
      .eq('utc_date', utcDayOf(now))
      .maybeSingle()
    const snap = {
      isHumanOpponent: battle.mode !== 'ai',
      outcome,
      usedDefend: moveSet.has('defend'),
      usedSpecial: moveSet.has('special'),
      weeklyWinsBefore: Math.max(0, (weeklyWinsBefore ?? 1) - 1),
      firstBattleToday: (todayRow?.count ?? 1) <= 1,
    }
    const missions: CompletedMission[] = evaluateForBattle(snap)
    await settleMissions(
      db,
      address,
      { xp: p.xp + xp, level: p.level, wins: p.wins + (outcome === 'win' ? 1 : 0) },
      missions,
      now,
    )
    // Badges: First Blade on a win, plus streak fields carried through.
    await settleBadges(
      db,
      address,
      {
        streakCurrent: p.streak_current,
        bracket: p.bracket as Bracket | null,
        withdrawalJustNow: false,
        hasBattleWin: outcome === 'win' || p.wins > 0,
        hasAnyCheckIn: p.check_in_count > 0,
      },
      now,
    )
  }
}

// ─── Item / move helpers ────────────────────────────────────────────────────

/** Items the viewer has activated so far this battle. */
async function activeItemsFor(
  db: SupabaseClient,
  battleId: string,
  address: string,
): Promise<ItemKey[]> {
  const { data } = await db
    .from('battle_moves')
    .select('item_key')
    .eq('battle_id', battleId)
    .eq('player_address', address)
    .eq('move_type', 'item')
  return (data ?? []).map((r) => r.item_key).filter((k): k is ItemKey => !!k)
}

function activeItemsFromMoves(moves: MoveRow[], address: string): ItemKey[] {
  return moves
    .filter((m) => m.player_address === address && m.move_type === 'item' && m.item_key)
    .map((m) => m.item_key as ItemKey)
}

async function playerReachedBronze(db: SupabaseClient, address: string): Promise<boolean> {
  const { data } = await db.from('players').select('bracket').eq('address', address).maybeSingle()
  const b = data?.bracket as Bracket | null
  return b === 'bronze' || b === 'silver' || b === 'gold'
}

function lastMoveOf(moves: MoveRow[], address: string, turn: number): BattleMove | null {
  const m = moves.find((x) => x.player_address === address && x.turn_number === turn)
  return m ? m.move_type : null
}

function chooseAiMove(
  battle: BattleRow,
  moves: MoveRow[],
  playerAddress: string,
  turn: number,
): BattleMove {
  // AI items are known statically (loadout decision) so modsForItems on them
  // gives specialCooldownOff only if we ever give the AI a Silver Charm.
  const aiMods = modsForItems([] as ItemKey[])
  const aiLast = lastMoveOf(moves, AI_ADDRESS, turn - 1)
  return aiChooseMove({
    aiHp: battle.player_b_hp,
    maxHp: BATTLE.startingHp,
    turnNumber: turn,
    aiSpecialAvailable: specialAvailable(aiLast, aiMods),
    playerLastMove: lastMoveOf(moves, playerAddress, turn - 1),
  })
}

async function incrementDailyBattles(db: SupabaseClient, address: string, day: string): Promise<number> {
  const { data: cur } = await db
    .from('daily_battles')
    .select('count')
    .eq('player_address', address)
    .eq('utc_date', day)
    .maybeSingle()
  if (cur) {
    await db
      .from('daily_battles')
      .update({ count: cur.count + 1 })
      .eq('player_address', address)
      .eq('utc_date', day)
    return cur.count
  }
  await db.from('daily_battles').insert({ player_address: address, utc_date: day, count: 1 })
  return 0
}

/** Quick Duel: "start one battle today" — credit on the first started battle. */
async function creditQuickDuel(db: SupabaseClient, address: string, now: Date) {
  const { data: p } = await db.from('players').select('xp, level').eq('address', address).single()
  if (!p) return
  await settleMissions(db, address, { xp: p.xp, level: p.level, wins: 0 }, [
    { key: 'quick_duel', xp: XP_VALUES.quickDuel, isOnetime: false },
  ], now)
}
