/**
 * Task 8 — GET /api/transfers/[hash] boundaries.
 *
 * The handler polls one claimed transfer and settles it. The invariants:
 *   • the hash is scoped to the caller — someone else's transfer is a 404, not
 *     a leak (the query itself carries the player filter, so this is asserted on
 *     the observed request, not on the fake's willingness to obey it)
 *   • an RPC outage is a 503 and writes nothing
 *   • a settled poll reports `changed: true` and a receipt
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, nodeTx, rows, type FakeNet, type FakeReply } from '@/test/fake-net'
import { authRequest } from '@/test/session'
import { GET } from '@/app/api/transfers/[hash]/route'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'
const HASH = 'ab'.repeat(32)

const VAULT_ROW = {
  address: VAULT,
  player_address: PLAYER,
  network: 'testnet',
  card_token: '11111111-1111-4111-8111-111111111111',
  backup_verified_at: '2026-11-02T00:00:00.000Z',
  created_at: '2026-11-02T00:00:00.000Z',
}

function transferRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    player_address: PLAYER,
    vault_address: VAULT,
    direction: 'in',
    amount_luna: 100_000,
    fee_luna: 0,
    tx_hash: HASH,
    status: 'pending',
    block_height: null,
    failure_reason: null,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    ...overrides,
  }
}

let net: FakeNet
afterEach(() => net?.restore())

function req(headers: Record<string, string> = {}): Request {
  return authRequest(`http://test/api/transfers/${HASH}`, { headers })
}

function call(hash = HASH, headers: Record<string, string> = { 'X-Player-Address': PLAYER }) {
  return GET(req(headers), { params: Promise.resolve({ hash }) })
}

function rpc(data: unknown): FakeReply {
  return { json: { jsonrpc: '2.0', id: 1, result: { data } } }
}

test('a poll without the player header is 401 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await call(HASH, {})
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('a hash that is not the caller\'s is a 404 — scoped in the query itself', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'transfers') return rows() // the scoped query matches nothing
    return undefined
  })

  const res = await call()
  assert.equal(res.status, 404)
  assert.deepEqual(await res.json(), { error: 'Not found' })

  const query = net.to('transfers')[0]
  assert.equal(query.query.get('tx_hash'), `eq.${HASH}`)
  assert.equal(query.query.get('player_address'), `eq.${PLAYER}`)
  assert.equal(net.node('getTransactionByHash').length, 0)
})

test('the hash from the URL is lowercased before the lookup', async () => {
  net = installFakeNet((c) => (c.resource === 'transfers' ? rows() : undefined))
  await call(HASH.toUpperCase())
  assert.equal(net.to('transfers')[0].query.get('tx_hash'), `eq.${HASH}`)
})

test('an RPC outage is a 503 and writes nothing', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'transfers') return rows(transferRow())
    if (c.resource === 'vaults') return rows(VAULT_ROW)
    if (c.nodeMethod === 'getTransactionByHash') throw new Error('ECONNREFUSED')
    return undefined
  })

  const res = await call()
  assert.equal(res.status, 503)
  const body = (await res.json()) as { error: string }
  assert.equal(body.error, 'rpc_unreachable')
  assert.equal(net.to('transfers').filter((c) => c.method === 'PATCH').length, 0)
})

test('a poll that settles reports changed: true and a testnet receipt', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'transfers' && c.method === 'GET') return rows(transferRow())
    if (c.resource === 'vaults') return rows(VAULT_ROW)
    if (c.resource === 'players' && c.method === 'GET') return rows({ address: PLAYER })
    if (c.resource === 'transfers' && c.method === 'PATCH') {
      return rows(transferRow({ status: 'included', block_height: 15_709_650, confirmed_at: new Date().toISOString() }))
    }
    if (c.resource === 'players') return rows()
    if (c.resource === 'player_items') return rows()
    if (c.nodeMethod === 'getTransactionByHash') return rpc(nodeTx())
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: 100_000, type: 'basic' })
    }
    return undefined
  })

  const res = await call()
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    transfer: { status: string; explorerUrl: string }
    changed: boolean
  }
  assert.equal(body.changed, true)
  assert.equal(body.transfer.status, 'included')
  assert.equal(body.transfer.explorerUrl, `https://test.nimiq.watch/#${HASH}`)

  // The settle update is conditional on pending.
  const update = net.to('transfers').find((c) => c.method === 'PATCH')!
  assert.equal(update.query.get('status'), 'eq.pending')
})

test('a poll of an already-included transfer reports changed: false and never re-polls', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'transfers') {
      return rows(transferRow({ status: 'included', block_height: 15_709_650, confirmed_at: new Date().toISOString() }))
    }
    if (c.resource === 'vaults') return rows(VAULT_ROW)
    return undefined
  })

  const res = await call()
  assert.equal(res.status, 200)
  const body = (await res.json()) as { changed: boolean; transfer: { status: string } }
  assert.equal(body.changed, false)
  assert.equal(body.transfer.status, 'included')
  assert.equal(net.node('getTransactionByHash').length, 0)
  assert.equal(net.to('transfers').filter((c) => c.method === 'PATCH').length, 0)
})
