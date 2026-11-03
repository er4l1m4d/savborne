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

// ─── Task 9b: expiry, races and withdrawal side effects ─────────────────────

type RecordedWrite = {
  table: string
  op: 'update' | 'upsert'
  payload: Record<string, unknown> | Record<string, unknown>[]
  filters: Array<{ col: string; value: unknown }>
}

/**
 * A fake DB that records every write with its filters, and can be told whether
 * a conditional update should match a row (the optimistic-lock loser case).
 */
function recordingDb(opts: { updateWins?: boolean; hasVault?: boolean } = {}) {
  const writes: RecordedWrite[] = []
  const updateWins = opts.updateWins ?? true

  const db = {
    from(table: string) {
      const filters: Array<{ col: string; value: unknown }> = []
      let op: 'select' | 'update' | 'upsert' = 'select'
      let payload: Record<string, unknown> | Record<string, unknown>[] | null = null

      const builder = {
        select() {
          return builder
        },
        eq(col: string, value: unknown) {
          filters.push({ col, value })
          return builder
        },
        in(col: string, value: unknown) {
          filters.push({ col, value })
          return builder
        },
        is(col: string, value: unknown) {
          filters.push({ col, value })
          return builder
        },
        order() {
          return builder
        },
        limit() {
          return builder
        },
        update(p: Record<string, unknown>) {
          op = 'update'
          payload = p
          writes.push({ table, op, payload: p, filters })
          return builder
        },
        upsert(p: Record<string, unknown>[]) {
          op = 'upsert'
          payload = p
          writes.push({ table, op, payload: p, filters })
          return builder
        },
        maybeSingle: async () => {
          if (op === 'update') {
            if (!updateWins) return { data: null, error: null }
            return { data: { ...transfer, ...(payload as Record<string, unknown>) }, error: null }
          }
          if (table === 'vaults') {
            return {
              data: opts.hasVault === false ? null : { address: VAULT, network: 'testnet' },
              error: null,
            }
          }
          if (table === 'players') return { data: { address: PLAYER }, error: null }
          if (table === 'player_items') return { data: [], error: null }
          return { data: null, error: null }
        },
      }
      return builder
    },
  }
  return { db: db as unknown as SupabaseClient, writes }
}

type NodeScript = {
  tx?: Record<string, unknown> | 'not-included' | 'unreachable'
  account?: Record<string, unknown> | 'unreachable'
}

/** A Nimiq node double that records every JSON-RPC method it was asked for. */
function nodeRpc(script: NodeScript): { rpc: RpcOptions; calls: string[] } {
  const calls: string[] = []
  const envelope = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  const rpc: RpcOptions = {
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init.body)) as { method: string }
      calls.push(body.method)

      if (body.method === 'getTransactionByHash') {
        if (script.tx === 'unreachable') throw new RpcError('unreachable', 'network down')
        if (script.tx === 'not-included') {
          return envelope({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32603,
              message: 'Transaction not found',
              data: 'Transaction not found',
            },
          })
        }
        return envelope({ jsonrpc: '2.0', id: 1, result: { data: script.tx } })
      }

      if (body.method === 'getAccountByAddress') {
        if (script.account === 'unreachable') throw new RpcError('unreachable', 'network down')
        return envelope({ jsonrpc: '2.0', id: 1, result: { data: script.account } })
      }

      throw new Error(`unexpected RPC method ${body.method}`)
    },
  }
  return { rpc, calls }
}

function chainTx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hash: HASH,
    blockNumber: 15_709_650,
    from: PLAYER,
    to: VAULT,
    value: 100_000,
    fee: 0,
    networkId: 5,
    executionResult: true,
    confirmations: 1,
    ...overrides,
  }
}

const CREATED_AT = '2026-11-02T10:00:00.000Z'
const at = (msAfterCreation: number) => new Date(new Date(CREATED_AT).getTime() + msAfterCreation)

test('a hash the chain never includes expires after 120 seconds, with a reason', async () => {
  const { db, writes } = recordingDb()
  const { rpc, calls } = nodeRpc({ tx: 'not-included' })

  const outcome = await pollAndSettle(db, transfer, { now: at(121_000), rpc })

  assert.equal(outcome.changed, true)
  assert.equal(outcome.transfer.status, 'expired')
  assert.equal(outcome.transfer.failure_reason, 'not_included')
  assert.equal(outcome.balanceLuna, null)

  const update = writes.find((w) => w.table === 'transfers')!
  assert.equal((update.payload as Record<string, unknown>).status, 'expired')
  assert.deepEqual(update.filters, [
    { col: 'id', value: transfer.id },
    { col: 'status', value: 'pending' },
  ])
  // No side effects beyond the terminal status write.
  assert.equal(writes.filter((w) => w.table !== 'transfers').length, 0)
  // Those side effects need a balance, which is never read for an expiry.
  assert.deepEqual(calls, ['getTransactionByHash'])
})

test('the expiry boundary is strict: exactly 120s old is still pending', async () => {
  const { db, writes } = recordingDb()
  const { rpc } = nodeRpc({ tx: 'not-included' })

  const outcome = await pollAndSettle(db, transfer, { now: at(120_000), rpc })

  assert.equal(outcome.changed, false)
  assert.equal(outcome.transfer.status, 'pending')
  assert.deepEqual(writes, [])
})

test('a concurrent poll that loses the conditional update writes no side effects', async () => {
  const { db, writes } = recordingDb({ updateWins: false })
  const { rpc } = nodeRpc({
    tx: chainTx(),
    account: { address: VAULT, balance: 0, type: 'basic' },
  })

  const outcome = await pollAndSettle(db, transfer, { now: at(1_000), rpc })

  assert.equal(outcome.changed, false)
  assert.equal(outcome.balanceLuna, null)
  assert.equal(outcome.transfer.status, 'pending')

  // The loser attempted exactly one write — the guarded one — and nothing else.
  const attempted = writes.filter((w) => w.table === 'transfers')
  assert.equal(attempted.length, 1)
  assert.deepEqual(attempted[0].filters, [
    { col: 'id', value: transfer.id },
    { col: 'status', value: 'pending' },
  ])
  assert.equal(writes.filter((w) => w.table !== 'transfers').length, 0)
})

test('an included-but-reverted transaction expires as execution_failed and is never credited', async () => {
  const { db, writes } = recordingDb()
  const { rpc } = nodeRpc({
    tx: chainTx({ executionResult: false }),
    account: { address: VAULT, balance: 0, type: 'basic' },
  })

  const outcome = await pollAndSettle(db, transfer, { now: at(1_000), rpc })

  assert.equal(outcome.changed, true)
  assert.equal(outcome.transfer.status, 'expired')
  assert.equal(outcome.transfer.failure_reason, 'execution_failed')
  // The balance was never read, so no credit path ran.
  assert.deepEqual(writes.map((w) => w.table), ['transfers'])
})

test('an unreachable node during the transaction read propagates and writes nothing', async () => {
  const { db, writes } = recordingDb()
  const { rpc } = nodeRpc({ tx: 'unreachable' })

  await assert.rejects(
    () => pollAndSettle(db, transfer, { now: at(1_000), rpc }),
    (err: unknown) => err instanceof RpcError && err.kind === 'unreachable',
  )
  assert.deepEqual(writes, [])
})

test('a missing vault is a no-op: no chain call, no write', async () => {
  const { db, writes } = recordingDb({ hasVault: false })
  const { rpc, calls } = nodeRpc({})

  const outcome = await pollAndSettle(db, transfer, { now: at(1_000), rpc })

  assert.equal(outcome.changed, false)
  assert.deepEqual(calls, [])
  assert.deepEqual(writes, [])
})

test('settling writes amount and fee from the chain, never from the claim', async () => {
  const { db, writes } = recordingDb()
  const { rpc } = nodeRpc({
    tx: chainTx({ fee: 1_234 }),
    account: { address: VAULT, balance: 0, type: 'basic' },
  })

  await pollAndSettle(db, transfer, { now: at(1_000), rpc })

  const update = writes.find((w) => w.table === 'transfers' && w.op === 'update')!
  const payload = update.payload as Record<string, unknown>
  assert.equal(payload.amount_luna, 100_000) // the chain value
  assert.equal(payload.fee_luna, 1_234) // the chain fee
  assert.equal(payload.block_height, 15_709_650)
  assert.equal(payload.confirmed_at, at(1_000).toISOString())
})

test('a settled withdrawal marks the player, revokes streak badges and restarts steady hand', async () => {
  const { db, writes } = recordingDb()
  const now = at(1_000)
  const { rpc } = nodeRpc({
    tx: chainTx({ from: VAULT, to: PLAYER }),
    account: { address: VAULT, balance: 0, type: 'basic' },
  })

  const outcome = await pollAndSettle(db, { ...transfer, direction: 'out' }, { now, rpc })
  assert.equal(outcome.changed, true)
  assert.equal(outcome.transfer.status, 'included')

  const playerWrite = writes.find((w) => w.table === 'players' && w.op === 'update')!
  const player = playerWrite.payload as Record<string, unknown>
  assert.equal(player.current_balance_luna, 0)
  assert.equal(player.withdrawal_in_progress, true)
  assert.equal(player.last_withdrawal_at, now.toISOString())
  assert.equal(player.steady_hand_started_at, now.toISOString())

  const badgeWrite = writes.find((w) => w.table === 'player_badges')!
  assert.equal((badgeWrite.payload as Record<string, unknown>).revoked_at, now.toISOString())
  assert.deepEqual(badgeWrite.filters, [
    { col: 'player_address', value: PLAYER },
    { col: 'badge_key', value: ['week_warrior', 'iron_saver'] },
    { col: 'revoked_at', value: null },
  ])
})

test('a settled deposit never sets withdrawal flags or revokes badges', async () => {
  const { db, writes } = recordingDb()
  const { rpc } = nodeRpc({
    tx: chainTx(),
    account: { address: VAULT, balance: 0, type: 'basic' },
  })

  await pollAndSettle(db, transfer, { now: at(1_000), rpc })

  const player = writes.find((w) => w.table === 'players')!.payload as Record<string, unknown>
  assert.equal('withdrawal_in_progress' in player, false)
  assert.equal('last_withdrawal_at' in player, false)
  assert.equal('steady_hand_started_at' in player, false)
  assert.equal(writes.some((w) => w.table === 'player_badges'), false)
})

