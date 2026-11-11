/**
 * GET /api/receipts
 *
 * One merged, newest-first timeline of everything that moved: transfers (with
 * their chain verdict) and balance snapshots. This is the screen a suspicious
 * player opens to check that their money went where they think it did.
 *
 * Before answering, a bounded sweep re-checks a few pending transfers. The
 * sweep is deliberately small and failure-tolerant: a hanging RPC must not
 * turn the receipts screen into a 500, so a settle failure leaves the row
 * pending and the response still succeeds.
 *
 * A snapshot has no hash, no block and no explorer link, by construction: the
 * DTO simply has no such key.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { CheckInRow, TransferRow, VaultRow } from '@/lib/database.types'
import type { Network } from '@/lib/nimiq'
import { mergeTimeline, toSnapshotItem, toTransferItem, type TimelineItem } from '@/lib/vault/receipts'
import { pollAndSettle } from '@/lib/vault/settle'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TRANSFER_COLUMNS =
  'id, player_address, vault_address, direction, amount_luna, fee_luna, tx_hash, status, block_height, failure_reason, created_at, confirmed_at'

/** Cap the per-request chain work. Receipts is a read screen, not a poller. */
const SWEEP_LIMIT = 5
/** Only re-check a transfer that has had time to reach a block. */
const SWEEP_MIN_AGE_MS = 10_000
const TIMELINE_LIMIT = 200

export async function GET(req: Request) {
  const auth = await requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address

  const db = supabaseAdmin()

  const { data: player } = await db.from('players').select('address').eq('address', address).maybeSingle()
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const { data: vaultRow } = await db
    .from('vaults')
    .select('address, network')
    .eq('player_address', address)
    .maybeSingle()
  const network = ((vaultRow as VaultRow | null)?.network ?? 'mainnet') as Network

  // Bounded sweep. Errors are swallowed on purpose: a stale receipt is a much
  // smaller problem than a broken receipts screen.
  const sweepCutoff = new Date(Date.now() - SWEEP_MIN_AGE_MS).toISOString()
  const { data: pending } = await db
    .from('transfers')
    .select(TRANSFER_COLUMNS)
    .eq('player_address', address)
    .eq('status', 'pending')
    .lt('created_at', sweepCutoff)
    .order('created_at', { ascending: true })
    .limit(SWEEP_LIMIT)

  for (const row of (pending ?? []) as TransferRow[]) {
    try {
      await pollAndSettle(db, row)
    } catch {
      // Leave it pending; the next visit tries again.
    }
  }

  const [{ data: transfers }, { data: checkIns }] = await Promise.all([
    db
      .from('transfers')
      .select(TRANSFER_COLUMNS)
      .eq('player_address', address)
      .order('created_at', { ascending: false })
      .limit(TIMELINE_LIMIT),
    db
      .from('check_ins')
      .select('id, player_address, balance_luna, recorded_at')
      .eq('player_address', address)
      .order('recorded_at', { ascending: false })
      .limit(TIMELINE_LIMIT),
  ])

  const items: TimelineItem[] = [
    ...((transfers ?? []) as TransferRow[]).map((row) => toTransferItem(row, network)),
    ...((checkIns ?? []) as CheckInRow[]).map(toSnapshotItem),
  ]

  return NextResponse.json({ items: mergeTimeline(items, TIMELINE_LIMIT) })
}
