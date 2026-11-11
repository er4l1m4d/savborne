/**
 * GET /api/cron/read-vaults
 *
 * Daily standing snapshot. Vercel calls this at 00:00 UTC when CRON_SECRET is
 * set, with `Authorization: Bearer $CRON_SECRET`.
 *
 * For every vault it reads the balance from the chain (never from a client),
 * derives the bracket in TypeScript, and calls `record_reading`, which updates
 * the player's standing and withdrawal/status flags but awards NO XP, NO
 * streak day and NO claim. The player's next check-in claims the stored
 * reading and only then earns the ritual rewards.
 *
 * Safety:
 *   - never accepts a player header as authority;
 *   - a missing or wrong secret is a 401 before any query;
 *   - pages are bounded (100 rows, 5 concurrent chain reads) and a cursor in
 *     `cron_state` lets the next run resume where this one stopped;
 *   - one vault failing never aborts the batch; the count is reported and the
 *     cursor still advances, so the next full cycle retries it;
 *   - no address is logged.
 */

import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'

import { supabaseAdmin } from '@/lib/supabase'
import { getAccount } from '@/lib/vault/rpc'
import { bracketFromLuna } from '@/lib/constants'
import type { Network } from '@/lib/nimiq'
import { reportEvent, requestIdFor, safeErrorDetails } from '@/lib/report'
import { routeError } from '@/lib/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PAGE_SIZE = 100
const CONCURRENCY = 5
const RPC_TIMEOUT_MS = 5_000
const TIME_BUDGET_MS = 20_000
const CURSOR_ID = 'read-vaults'

type VaultPageRow = {
  address: string
  player_address: string
  network: string
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return false

  // Hash both sides so the comparison is length-independent and constant time.
  const provided = createHash('sha256').update(header.slice(7)).digest()
  const expected = createHash('sha256').update(secret).digest()
  return timingSafeEqual(provided, expected)
}

/** Run async work with a fixed concurrency, preserving order of results. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++
      if (index >= items.length) return
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const db = supabaseAdmin()
  const recordedAt = new Date().toISOString()

  // Expired sessions have no further use; removing them keeps the per-request
  // liveness check cheap.
  await db.from('player_sessions').delete().lt('expires_at', recordedAt)

  let processed = 0
  let recorded = 0
  let failed = 0
  let withdrawals = 0
  let cursor: string | null = null
  let hasMore = false

  const { data: state, error: stateErr } = await db
    .from('cron_state')
    .select('cursor')
    .eq('id', CURSOR_ID)
    .maybeSingle()
  if (stateErr) {
    return routeError({
      req,
      route: '/api/cron/read-vaults',
      code: 'db_error',
      status: 500,
      error: stateErr,
    })
  }
  cursor = (state?.cursor as string | null) ?? null

  for (;;) {
    if (Date.now() - started >= TIME_BUDGET_MS) {
      hasMore = true
      break
    }

    let query = db
      .from('vaults')
      .select('address, player_address, network')
      .order('address', { ascending: true })
      .limit(PAGE_SIZE)
    if (cursor) query = query.gt('address', cursor)

    const { data, error } = await query
    if (error) {
      return routeError({
        req,
        route: '/api/cron/read-vaults',
        code: 'db_error',
        status: 500,
        error,
      })
    }

    const page = (data ?? []) as VaultPageRow[]
    if (page.length === 0) {
      cursor = null
      hasMore = false
      break
    }

    // Stop starting chunks once the budget is spent. A chunk that has already
    // started is at most CONCURRENCY * RPC_TIMEOUT_MS, so the function stays
    // under its 60s ceiling even when every endpoint hangs.
    let pageProcessed = 0
    const outcomes: { ok: boolean; withdrawal?: boolean }[] = []
    for (let offset = 0; offset < page.length; offset += CONCURRENCY) {
      if (Date.now() - started >= TIME_BUDGET_MS) break
      const chunk = page.slice(offset, offset + CONCURRENCY)
      const chunkOutcomes = await mapLimit(chunk, CONCURRENCY, async (vault) => {
      try {
        const account = await getAccount(vault.address, vault.network as Network, {
          timeoutMs: RPC_TIMEOUT_MS,
        })
        const bracket = bracketFromLuna(account.balanceLuna)
        const { data: result, error: rpcErr } = await db.rpc('record_reading', {
          p_address: vault.player_address,
          p_balance_luna: Math.floor(account.balanceLuna),
          p_recorded_at: recordedAt,
          p_bracket: bracket,
        })
        if (rpcErr) throw rpcErr
        return { ok: true as const, withdrawal: Boolean(result?.withdrawal) }
      } catch (error) {
        reportEvent({
          route: '/api/cron/read-vaults',
          code: 'reading_failed',
          status: 500,
          requestId: requestIdFor(req),
          ...safeErrorDetails(error),
        })
        return { ok: false as const }
      }
      })
      outcomes.push(...chunkOutcomes)
      pageProcessed += chunk.length
    }

    processed += pageProcessed
    for (const outcome of outcomes) {
      if (outcome.ok) {
        recorded++
        if (outcome.withdrawal) withdrawals++
      } else {
        failed++
      }
    }

    if (pageProcessed === 0) {
      // The budget ran out before the first chunk. Keep the previous cursor so
      // the next run starts at the same place.
      hasMore = true
      break
    }

    const pageDone = pageProcessed === page.length
    cursor = pageDone
      ? (page.length === PAGE_SIZE ? page[page.length - 1].address : null)
      : page[pageProcessed - 1].address
    hasMore = page.length === PAGE_SIZE || !pageDone

    const { error: saveErr } = await db.from('cron_state').upsert(
      { id: CURSOR_ID, cursor, updated_at: recordedAt },
      { onConflict: 'id' },
    )
    if (saveErr) {
      reportEvent({
        route: '/api/cron/read-vaults',
        code: 'cursor_save_failed',
        status: 500,
        requestId: requestIdFor(req),
        ...safeErrorDetails(saveErr),
      })
      break
    }

    if (!hasMore) break
  }

  const elapsedMs = Date.now() - started
  const incomplete = hasMore

  return NextResponse.json({
    ok: true,
    processed,
    recorded,
    failed,
    withdrawals,
    incomplete,
    cursor,
    elapsedMs,
  })
}
