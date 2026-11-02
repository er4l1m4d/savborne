/**
 * Savborne — vault DTO
 *
 * The database rows are snake_case; the API is camelCase. Both `/api/players`
 * and `/api/vaults` serialize the same resource, so the mapping lives in one
 * place. The phrase is absent by construction: the server never has it.
 */

import type { VaultRow, TransferRow } from '@/lib/database.types'
import type { Network } from '@/lib/nimiq'
import { explorerTxUrl } from './network'

export type VaultDto = {
  address: string
  network: Network
  cardToken: string
  backupVerifiedAt: string | null
  createdAt: string
}

export function toVaultDto(row: VaultRow): VaultDto {
  return {
    address: row.address,
    network: row.network,
    cardToken: row.card_token,
    backupVerifiedAt: row.backup_verified_at,
    createdAt: row.created_at,
  }
}

export type TransferDto = {
  id: number
  direction: 'in' | 'out'
  amountLuna: number
  feeLuna: number
  txHash: string
  status: 'pending' | 'included' | 'expired'
  blockHeight: number | null
  failureReason: string | null
  /** `null` until the transfer is included: a pending hash has no receipt. */
  explorerUrl: string | null
  createdAt: string
  confirmedAt: string | null
}

/**
 * `network` comes from the caller's vault. A pending transfer has no explorer
 * link on purpose: a link is a receipt, and only inclusion produces one.
 */
export function toTransferDto(row: TransferRow, network: Network): TransferDto {
  return {
    id: Number(row.id),
    direction: row.direction,
    amountLuna: Number(row.amount_luna),
    feeLuna: Number(row.fee_luna),
    txHash: row.tx_hash,
    status: row.status,
    blockHeight: row.block_height === null ? null : Number(row.block_height),
    failureReason: row.failure_reason,
    explorerUrl: row.status === 'included' ? explorerTxUrl(network, row.tx_hash) : null,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  }
}
