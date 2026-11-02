/**
 * GET /api/transfers/[hash]
 *
 * Polls one transfer, settles it if the chain now has it, and reports whether
 * anything changed. The hash is scoped to the caller: a transfer that belongs
 * to someone else is a 404, never a leak.
 *
 * Next 16: dynamic route params are a Promise and must be awaited.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import type { TransferRow, VaultRow } from '@/lib/database.types'
import { toTransferDto } from '@/lib/vault/dto'
import type { Network } from '@/lib/nimiq'
import { RpcError } from '@/lib/vault/rpc'
import { pollAndSettle } from '@/lib/vault/settle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TRANSFER_COLUMNS =
  'id, player_address, vault_address, direction, amount_luna, fee_luna, tx_hash, status, block_height, failure_reason, created_at, confirmed_at'

export async function GET(req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params

  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing player header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data: row, error } = await db
    .from('transfers')
    .select(TRANSFER_COLUMNS)
    .eq('tx_hash', hash.toLowerCase())
    .eq('player_address', address)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: vaultRow } = await db
    .from('vaults')
    .select('address, player_address, network, card_token, backup_verified_at, created_at')
    .eq('address', (row as TransferRow).vault_address)
    .maybeSingle()
  const network = ((vaultRow as VaultRow | null)?.network ?? 'mainnet') as Network

  try {
    const outcome = await pollAndSettle(db, row as TransferRow)
    return NextResponse.json({
      transfer: toTransferDto(outcome.transfer, network),
      changed: outcome.changed,
    })
  } catch (err) {
    if (err instanceof RpcError) {
      return NextResponse.json({ error: 'rpc_unreachable', reason: err.message }, { status: 503 })
    }
    throw err
  }
}
