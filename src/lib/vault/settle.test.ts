/**
 * Task 9 — settle ordering.
 *
 * The bug this guards against is subtle and was real: if the row is flipped to
 * `included` before the post-settlement balance is read, an RPC failure leaves
 * the transfer settled with its side effects (balance, bracket, items)
 * permanently skipped — the `status !== 'pending'` guard short-circuits every
 * retry. The account read must therefore happen BEFORE the conditional update.
 *
 * A fake DB and fake fetch make the ordering observable: the test asserts that
 * no `included` write happened when the balance read throws.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TransferRow } from '@/lib/database.types'
import type { RpcOptions } from './rpc'
import { RpcError } from './rpc'
import { pollAndSettle } from './settle'

const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'
const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const HASH = 'ab'.repeat(32)

const transfer: TransferRow = {
  id: 1,
  player_address: PLAYER,
  vault_address: VAULT,
  direction: 'in',
  amount_luna: 100_000,
  fee_luna: 0,
  tx_hash: HASH,
  status: 'pending',
  block_height: null,
  failure_reason: null,
  created_at: '2026-11-02T10:00:00.000Z',
  confirmed_at: null,
}

/** Records which tables were written to, in order. */
function fakeDb(written: string[]): SupabaseClient {
  const row = { ...transfer, network: 'testnet' }
  const handler = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select() {
          return chain
        },
        eq() {
          return chain
        },
        maybeSingle: async () => {
          if (table === 'vaults') return { data: { address: VAULT, network: 'testnet' }, error: null }
          if (table === 'players') return { data: { address: PLAYER }, error: null }
          if (table === 'player_items') return { data: [], error: null }
          return { data: null, error: null }
        },
        update(payload: Record<string, unknown>) {
          if (payload.status === 'included') written.push('transfers:included')
          if (table === 'players') written.push('players:update')
          return {
            eq() {
              return this
            },
            in() {
              return this
            },
            is() {
              return this
            },
            select() {
              return this
            },
            maybeSingle: async () => {
              if (table === 'transfers' && payload.status === 'included') {
                return { data: { ...row, ...payload }, error: null }
              }
              return { data: null, error: null }
            },
          }
        },
        upsert: async () => ({ data: null, error: null }),
      }
      return chain
    },
  }
  return handler as unknown as SupabaseClient
}

/** A node that knows the transaction but fails the account read. */
const failingAccountRpc: RpcOptions = {
  fetchImpl: async (_input, init) => {
    const body = JSON.parse(String(init.body)) as { method: string }
    if (body.method === 'getAccountByAddress') {
      throw new RpcError('unreachable', 'network down')
    }
    // getTransactionByHash: an included, successful deposit.
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          data: {
            hash: HASH,
            blockNumber: 15_709_650,
            from: PLAYER,
            to: VAULT,
            value: 100_000,
            fee: 0,
            networkId: 5,
            executionResult: true,
            confirmations: 1,
          },
        },
      }),
      { status: 200 },
    )
  },
}

test('an account-read failure leaves the transfer pending, not included', async () => {
  const written: string[] = []
  await assert.rejects(() => pollAndSettle(fakeDb(written), transfer, { rpc: failingAccountRpc }))
  assert.deepEqual(written, [], 'no write of any kind happened')
})

test('a settled transfer with a healthy node writes included, then the player', async () => {
  const written: string[] = []
  const healthyRpc: RpcOptions = {
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init.body)) as { method: string }
      if (body.method === 'getAccountByAddress') {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 1, result: { data: { address: VAULT, balance: 250_000, type: 'basic' } } }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            data: {
              hash: HASH,
              blockNumber: 15_709_650,
              from: PLAYER,
              to: VAULT,
              value: 100_000,
              fee: 0,
              networkId: 5,
              executionResult: true,
              confirmations: 1,
            },
          },
        }),
        { status: 200 },
      )
    },
  }

  const outcome = await pollAndSettle(fakeDb(written), transfer, { rpc: healthyRpc })
  assert.equal(outcome.changed, true)
  assert.equal(outcome.balanceLuna, 250_000)
  // Included is written before the player update — the ordering the fix requires.
  assert.deepEqual(written, ['transfers:included', 'players:update'])
})

test('a non-pending transfer is never re-settled', async () => {
  const written: string[] = []
  const outcome = await pollAndSettle(fakeDb(written), { ...transfer, status: 'included' })
  assert.equal(outcome.changed, false)
  assert.deepEqual(written, [])
})
