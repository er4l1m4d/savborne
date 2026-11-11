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
import { RANKED, BATTLE, type Bracket, bracketFromLuna } from '@/lib/constants'
import { utcDayOf } from '@/lib/game/time'
import { routeError } from '@/lib/report'
import { rateLimitOrError } from '@/lib/rate-limit'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'
import { getAccount, RpcError } from '@/lib/vault/rpc'
import type { Network } from '@/lib/nimiq'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Ranked eligibility must reflect the vault's balance at the moment of truth,
 * not the last check-in. A 60s in-process cache bounds chain calls when a
 * client retries; a cache miss always reads the chain. A null bracket is
 * cached too (an empty vault stays empty for the same minute).
 */
const BALANCE_TTL_MS = 60_000
const bracketCache = new Map<string, { at: number; bracket: Bracket | null }>()

async function freshBracket(vaultAddress: string, network: Network): Promise<Bracket | null> {
  const key = `${network}:${vaultAddress}`
  const cached = bracketCache.get(key)
  if (cached && Date.now() - cached.at < BALANCE_TTL_MS) return cached.bracket

  const account = await getAccount(vaultAddress, network)
  const bracket = bracketFromLuna(account.balanceLuna)
  bracketCache.set(key, { at: Date.now(), bracket })
  return bracket
}

export async function POST(req: Request) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address
  const limited = await rateLimitOrError({
    req,
    route: '/api/queue/join',
    key: `queue-join:${address}`,
    limit: 20,
    windowSeconds: 60,
  })
  if (limited) return limited


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
  const { data: vault, error: vaultErr } = await db
    .from('vaults')
    .select('address, network')
    .eq('player_address', address)
    .maybeSingle()
  if (vaultErr) {
    return routeError({ req, route: '/api/queue/join', code: 'db_error', status: 500, error: vaultErr })
  }
  if (!vault) {
    return NextResponse.json(
      { error: 'You need at least 1 NIM in your savings account to enter ranked.' },
      { status: 403 },
    )
  }

  let bracket: Bracket | null
  try {
    bracket = await freshBracket(vault.address, vault.network as Network)
  } catch (err) {
    if (err instanceof RpcError) {
      return routeError({
        req, route: '/api/queue/join', code: 'rpc_unreachable', status: 503, error: err,
      })
    }
    return routeError({ req, route: '/api/queue/join', code: 'db_error', status: 500, error: err })
  }
  if (!bracket) {
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
    bracket,
    rating: p.rating,
    entered_at: now.toISOString(),
    last_poll_at: now.toISOString(),
    status: 'waiting',
    battle_id: null,
  }, { onConflict: 'player_address' })
  if (error) {
    return routeError({ req, route: '/api/queue/join', code: 'db_error', status: 500, error })
  }

  return NextResponse.json({ ok: true, waiting: true }, { status: 201 })
}
