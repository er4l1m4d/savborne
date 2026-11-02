/**
 * Savborne — settle a claimed transfer against the chain
 *
 * `pollAndSettle` is the only place that writes `included`. Every route that
 * can observe a transfer calls it: POST, GET /[hash], and the receipts sweep.
 *
 * The rules the money depends on:
 *   • a settled transfer is never re-settled (the early guard)
 *   • the update is conditional on `status = 'pending'`, so two concurrent
 *     polls agree on a single winner and side effects run once
 *   • amount and fee are overwritten from the chain, never from the claim
 *   • a failed verification becomes `expired` with a reason, never `included`
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { bracketFromLuna } from '@/lib/constants'
import type { TransferRow } from '@/lib/database.types'
import { itemsToUnlock, type ItemKey } from '@/lib/game/items'
import { getAccount, getChainTransaction, type RpcOptions } from './rpc'
import { VAULT_NETWORK_ID } from './network'
import { verifyClaim, type FailureReason } from './verify'

export type SettleOutcome = {
  transfer: TransferRow
  changed: boolean
  balanceLuna: number | null
}

/** A hash that never reaches a block within this window is treated as expiring. */
const EXPIRY_MS = 120_000

export async function pollAndSettle(
  db: SupabaseClient,
  transfer: TransferRow,
  opts?: { now?: Date; rpc?: RpcOptions },
): Promise<SettleOutcome> {
  const now = opts?.now ?? new Date()

  // 1. Never re-settle. Re-running the side effects would re-stamp
  //    steady_hand_started_at and last_withdrawal_at on every poll.
  if (transfer.status !== 'pending') {
    return { transfer, changed: false, balanceLuna: null }
  }

  const vault = await loadVault(db, transfer.vault_address)
  if (!vault) {
    // Should be impossible (transfers.vault_address references vaults.address).
    return { transfer, changed: false, balanceLuna: null }
  }

  // 2. Read the chain. An RpcError propagates; the caller answers 503 and
  //    nothing is written.
  const tx = await getChainTransaction(transfer.tx_hash, vault.network, opts?.rpc)

  // 3. Not known yet.
  if (!tx) {
    const age = now.getTime() - new Date(transfer.created_at).getTime()
    if (age > EXPIRY_MS) {
      return expire(db, transfer, 'not_included')
    }
    return { transfer, changed: false, balanceLuna: null }
  }

  // 4. The chain knows it. Does it satisfy the claim?
  const player = await loadPlayerAddress(db, transfer.player_address)
  const verdict = verifyClaim(tx, {
    direction: transfer.direction,
    amountLuna: Number(transfer.amount_luna),
    vaultAddress: transfer.vault_address,
    playerAddress: player ?? '',
    networkId: vault.networkId,
  })
  if (!verdict.ok) {
    return expire(db, transfer, verdict.reason)
  }

  // 5. Read the vault's post-settlement balance BEFORE flipping the row to
  //    `included`. Order matters: if the RPC fails here, the transfer stays
  //    `pending` and the next poll retries it. Reading after the update would
  //    strand the row as `included` with its side effects permanently skipped,
  //    because the `status !== 'pending'` guard would short-circuit every retry.
  const account = await getAccount(vault.address, vault.network, opts?.rpc)
  const newBracket = bracketFromLuna(account.balanceLuna)

  // 6. Settle. Conditional on pending so concurrent polls agree on one winner.
  const { data: updated, error } = await db
    .from('transfers')
    .update({
      status: 'included',
      block_height: tx.blockNumber,
      amount_luna: tx.valueLuna, // from chain, never from the claim
      fee_luna: tx.feeLuna, // from chain
      confirmed_at: now.toISOString(),
    })
    .eq('id', transfer.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!updated) {
    // Someone else won the race. Their side effects are already running.
    return { transfer, changed: false, balanceLuna: null }
  }

  const settled = updated as TransferRow

  // 7. Side effects, only for the winner.
  const playerUpdate: Record<string, unknown> = {
    current_balance_luna: Math.floor(account.balanceLuna),
    bracket: newBracket,
  }

  if (transfer.direction === 'out') {
    playerUpdate.withdrawal_in_progress = true
    playerUpdate.last_withdrawal_at = now.toISOString()
    playerUpdate.steady_hand_started_at = now.toISOString()
  }

  const { error: playerErr } = await db
    .from('players')
    .update(playerUpdate)
    .eq('address', transfer.player_address)
  if (playerErr) console.error('Failed to update player after settle:', playerErr.message)

  if (transfer.direction === 'out') {
    // Withdrawals revoke the streak badges immediately (existing rules).
    const { error: badgeErr } = await db
      .from('player_badges')
      .update({ revoked_at: now.toISOString() })
      .eq('player_address', transfer.player_address)
      .in('badge_key', ['week_warrior', 'iron_saver'])
      .is('revoked_at', null)
    if (badgeErr) console.error('Failed to revoke badges:', badgeErr.message)
  }

  await unlockItems(db, transfer.player_address, newBracket)

  return { transfer: settled, changed: true, balanceLuna: account.balanceLuna }
}

/** Mark a pending transfer terminal with a reason. Never touches a settled row. */
async function expire(
  db: SupabaseClient,
  transfer: TransferRow,
  reason: FailureReason,
): Promise<SettleOutcome> {
  const { data } = await db
    .from('transfers')
    .update({ status: 'expired', failure_reason: reason })
    .eq('id', transfer.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle()

  if (!data) return { transfer, changed: false, balanceLuna: null }
  return { transfer: data as TransferRow, changed: true, balanceLuna: null }
}

async function loadVault(
  db: SupabaseClient,
  vaultAddress: string,
): Promise<{ address: string; network: 'mainnet' | 'testnet'; networkId: number } | null> {
  const { data } = await db
    .from('vaults')
    .select('address, network')
    .eq('address', vaultAddress)
    .maybeSingle()
  if (!data) return null
  const network = data.network as 'mainnet' | 'testnet'
  return {
    address: data.address as string,
    network,
    networkId: VAULT_NETWORK_ID[network],
  }
}

async function loadPlayerAddress(db: SupabaseClient, playerAddress: string): Promise<string | null> {
  const { data } = await db
    .from('players')
    .select('address')
    .eq('address', playerAddress)
    .maybeSingle()
  return data ? (data.address as string) : null
}

/** Same rule the check-in route applies: items unlock when the bracket is met. */
async function unlockItems(
  db: SupabaseClient,
  playerAddress: string,
  bracket: ReturnType<typeof bracketFromLuna>,
): Promise<void> {
  const { data: owned } = await db
    .from('player_items')
    .select('item_key')
    .eq('player_address', playerAddress)

  const ownedKeys = new Set<ItemKey>((owned ?? []).map((r) => r.item_key as ItemKey))
  const toUnlock = itemsToUnlock(ownedKeys, bracket)
  if (toUnlock.length === 0) return

  const rows = toUnlock.map((key) => ({
    player_address: playerAddress,
    item_key: key,
    unlocked_at: new Date().toISOString(),
  }))
  const { error } = await db
    .from('player_items')
    .upsert(rows, { onConflict: 'player_address,item_key', ignoreDuplicates: true })
  if (error) console.error('Failed to unlock items after settle:', error.message)
}
