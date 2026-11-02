/**
 * Task 14 — the receipts invariant.
 *
 * The whole point of this screen is that a balance snapshot can never be
 * mistaken for a confirmed transaction. That is a property of the DTO, so it
 * is asserted on the DTO: a snapshot object has no `txHash` and no
 * `explorerUrl` key at all.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { TransferRow, CheckInRow } from '@/lib/database.types'
import { mergeTimeline, toSnapshotItem, toTransferItem } from './receipts'

const HASH = 'ab'.repeat(32)

function transfer(overrides: Partial<TransferRow> = {}): TransferRow {
  return {
    id: 1,
    player_address: 'NQ81 C01N',
    vault_address: 'NQ57 2F6C',
    direction: 'in',
    amount_luna: 100_000,
    fee_luna: 0,
    tx_hash: HASH,
    status: 'included',
    block_height: 15_709_650,
    failure_reason: null,
    created_at: '2026-11-02T10:00:00.000Z',
    confirmed_at: '2026-11-02T10:00:05.000Z',
    ...overrides,
  }
}

function checkIn(overrides: Partial<CheckInRow> = {}): CheckInRow {
  return {
    id: 7,
    player_address: 'NQ81 C01N',
    balance_luna: 250_000,
    recorded_at: '2026-11-02T09:00:00.000Z',
    ...overrides,
  }
}

test('a snapshot has no txHash and no explorerUrl key at all', () => {
  const item = toSnapshotItem(checkIn())
  assert.equal('txHash' in item, false)
  assert.equal('explorerUrl' in item, false)
  assert.deepEqual(Object.keys(item).sort(), ['at', 'balanceLuna', 'id', 'kind'])
})

test('an included transfer gets an explorer link on the right network', () => {
  const mainnet = toTransferItem(transfer(), 'mainnet')
  assert.equal(mainnet.explorerUrl, `https://nimiq.watch/#${HASH}`)

  const testnet = toTransferItem(transfer(), 'testnet')
  assert.equal(testnet.explorerUrl, `https://test.nimiq.watch/#${HASH}`)
})

test('a pending transfer has no explorer link — it has no receipt yet', () => {
  const item = toTransferItem(transfer({ status: 'pending', block_height: null }), 'testnet')
  assert.equal(item.explorerUrl, null)
})

test('an expired transfer never gets an explorer link', () => {
  const item = toTransferItem(
    transfer({ status: 'expired', block_height: null, failure_reason: 'not_included' }),
    'mainnet',
  )
  assert.equal(item.explorerUrl, null)
  assert.equal(item.failureReason, 'not_included')
})

test('the timeline is newest-first regardless of row type', () => {
  const merged = mergeTimeline(
    [
      toSnapshotItem(checkIn({ recorded_at: '2026-11-02T09:00:00.000Z' })),
      toTransferItem(transfer({ created_at: '2026-11-02T11:00:00.000Z' }), 'mainnet'),
      toSnapshotItem(checkIn({ id: 8, recorded_at: '2026-11-02T10:30:00.000Z' })),
    ],
    200,
  )
  assert.deepEqual(
    merged.map((i) => i.at),
    ['2026-11-02T11:00:00.000Z', '2026-11-02T10:30:00.000Z', '2026-11-02T09:00:00.000Z'],
  )
})

test('the timeline is capped at the limit', () => {
  const items = Array.from({ length: 10 }, (_, i) =>
    toSnapshotItem(checkIn({ id: i, recorded_at: `2026-11-0${(i % 9) + 1}T00:00:00.000Z` })),
  )
  assert.equal(mergeTimeline(items, 3).length, 3)
})
