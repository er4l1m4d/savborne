/**
 * /api/transfers
 *
 *   GET  -> { transfers: TransferDto[] }   the caller's last 50, newest first
 *           No chain calls: listing must stay fast.
 *   POST -> claim a broadcast transfer, verify it on chain, settle if it is
 *           already included.
 *             body { direction, txHash, amountLuna, network }
 *             202 { transfer, verified }              new claim
 *             200 { transfer, verified }              idempotent replay
 *             422 malformed
 *             403 backup_required
 *             404 player not found
 *             409 vault_required | network_mismatch | tx_hash_conflict
 *
 * A client-supplied hash is a claim, not a fact. Ownership of a hash is
 * single: deposit hashes are public on chain, so a hash already owned by
 * another player is a conflict and its row is never serialized.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import type { TransferRow, VaultRow } from '@/lib/database.types'
import { toTransferDto } from '@/lib/vault/dto'
import type { Network } from '@/lib/nimiq'
import { isNetwork } from '@/lib/vault/network'
import { RpcError } from '@/lib/vault/rpc'
import { pollAndSettle } from '@/lib/vault/settle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TX_HASH_RE = /^[0-9a-f]{64}$/i

const TRANSFER_COLUMNS =
  'id, player_address, vault_address, direction, amount_luna, fee_luna, tx_hash, status, block_height, failure_reason, created_at, confirmed_at'

export async function GET(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing player header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('transfers')
    .select(TRANSFER_COLUMNS)
    .eq('player_address', address)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const network = await vaultNetwork(db, address)
  return NextResponse.json({
    transfers: (data ?? []).map((row) => toTransferDto(row as TransferRow, network)),
  })
}

export async function POST(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing player header' }, { status: 401 })
  }

  let body: { direction?: unknown; txHash?: unknown; amountLuna?: unknown; network?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 })
  }

  const { direction, txHash, amountLuna, network } = body
  if (
    (direction !== 'in' && direction !== 'out') ||
    typeof txHash !== 'string' ||
    !TX_HASH_RE.test(txHash) ||
    typeof amountLuna !== 'number' ||
    !Number.isSafeInteger(amountLuna) ||
    amountLuna <= 0 ||
    !isNetwork(network)
  ) {
    return NextResponse.json({ error: 'Malformed transfer' }, { status: 422 })
  }

  const db = supabaseAdmin()

  const { data: player } = await db.from('players').select('address').eq('address', address).maybeSingle()
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const { data: vaultRow } = await db
    .from('vaults')
    .select('address, player_address, network, card_token, backup_verified_at, created_at')
    .eq('player_address', address)
    .maybeSingle()
  if (!vaultRow) {
    return NextResponse.json({ error: 'vault_required' }, { status: 409 })
  }
  const vault = vaultRow as VaultRow

  // The backup gate cannot be skipped by ignoring the UI. It cannot stop a
  // hand-crafted request that lies, but a liar only endangers their own funds.
  if (direction === 'in' && vault.backup_verified_at === null) {
    return NextResponse.json({ error: 'backup_required' }, { status: 403 })
  }
  if (network !== vault.network) {
    return NextResponse.json({ error: 'network_mismatch' }, { status: 409 })
  }

  const insert = await db
    .from('transfers')
    .insert({
      player_address: address,
      vault_address: vault.address,
      direction,
      amount_luna: amountLuna,
      tx_hash: txHash.toLowerCase(),
      status: 'pending',
    })
    .select(TRANSFER_COLUMNS)
    .maybeSingle()

  let transfer: TransferRow
  let replay = false

  if (insert.error) {
    if (!isUniqueViolation(insert.error)) {
      return NextResponse.json({ error: insert.error.message }, { status: 500 })
    }
    const { data: existing } = await db
      .from('transfers')
      .select(TRANSFER_COLUMNS)
      .eq('tx_hash', txHash.toLowerCase())
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: 'transfer_conflict' }, { status: 409 })
    }
    const row = existing as TransferRow
    if (row.player_address !== address) {
      // Never serialize someone else's transfer.
      return NextResponse.json({ error: 'tx_hash_conflict' }, { status: 409 })
    }
    transfer = row
    replay = true
  } else {
    transfer = insert.data as TransferRow
  }

  // A pending transfer is a valid state, not a failure: an RPC hiccup must
  // not turn it into an error the user sees.
  let verified = false
  try {
    const outcome = await pollAndSettle(db, transfer)
    transfer = outcome.transfer
    verified = outcome.changed && transfer.status === 'included'
  } catch (err) {
    if (!(err instanceof RpcError)) throw err
  }

  return NextResponse.json(
    { transfer: toTransferDto(transfer, vault.network as Network), verified },
    { status: replay ? 200 : 202 },
  )
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || (error.message ?? '').includes('duplicate key')
}

async function vaultNetwork(db: ReturnType<typeof supabaseAdmin>, address: string): Promise<Network> {
  const { data } = await db.from('vaults').select('network').eq('player_address', address).maybeSingle()
  return (data?.network as Network) ?? 'mainnet'
}
