/**
 * Savborne — receipts timeline (pure)
 *
 * The receipts screen merges two row types that must never be confused. That
 * invariant is asserted here rather than eyeballed at the call site: a
 * snapshot has no `txHash` and no `explorerUrl` key at all, and only an
 * `included` transfer has a link.
 *
 * No I/O, so route handlers and tests share it.
 */

import type { TransferRow, CheckInRow } from '@/lib/database.types'
import type { Network } from '@/lib/nimiq'
import { explorerTxUrl } from './network'

export type TransferItem = {
  kind: 'transfer'
  id: number
  direction: 'in' | 'out'
  amountLuna: number
  feeLuna: number
  txHash: string
  status: 'pending' | 'included' | 'expired'
  blockHeight: number | null
  failureReason: string | null
  explorerUrl: string | null
  at: string
}

export type SnapshotItem = {
  kind: 'snapshot'
  id: number
  balanceLuna: number
  at: string
}

export type TimelineItem = TransferItem | SnapshotItem

export function toTransferItem(row: TransferRow, network: Network): TransferItem {
  return {
    kind: 'transfer',
    id: Number(row.id),
    direction: row.direction,
    amountLuna: Number(row.amount_luna),
    feeLuna: Number(row.fee_luna),
    txHash: row.tx_hash,
    status: row.status,
    blockHeight: row.block_height === null ? null : Number(row.block_height),
    failureReason: row.failure_reason,
    // A pending transfer has no receipt yet, and an expired one never will.
    explorerUrl: row.status === 'included' ? explorerTxUrl(network, row.tx_hash) : null,
    at: row.created_at,
  }
}

/** Deliberately has no `txHash` and no `explorerUrl`: a balance reading is not a receipt. */
export function toSnapshotItem(row: CheckInRow): SnapshotItem {
  return {
    kind: 'snapshot',
    id: Number(row.id),
    balanceLuna: Number(row.balance_luna),
    at: row.recorded_at,
  }
}

/** Newest first, capped. Ties keep their input order. */
export function mergeTimeline(items: TimelineItem[], limit: number): TimelineItem[] {
  const sorted = [...items].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return sorted.slice(0, limit)
}
