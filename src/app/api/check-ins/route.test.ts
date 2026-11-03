/**
 * Task 8 — POST /api/check-ins boundaries.
 *
 * The security claim this build exists to make: the balance is read from the
 * vault's chain account, never from the request. These tests assert that on the
 * observed traffic and on the row that is actually inserted.
 *
 * Also covered: 401 / 404 / 409 vault_required / 503 rpc_unreachable.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet, type FakeReply } from '@/test/fake-net'
import { POST } from '@/app/api/check-ins/route'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'

const PLAYER_ROW = {
  address: PLAYER,
  check_in_count: 0,
  xp: 0,
  level: 1,
  streak_current: 0,
  streak_best: 0,
  shields: 1,
  shields_earned: 0,
  bracket: null,
  wins: 0,
  steady_hand_started_at: null,
  last_check_in_at: null,
  current_balance_luna: 0,
}

let net: FakeNet
afterEach(() => net?.restore())

function req(body: unknown = {}, headers: Record<string, string> = { 'X-Player-Address': PLAYER }): Request {
  return new Request('http://test/api/check-ins', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function rpc(data: unknown): FakeReply {
  return { json: { jsonrpc: '2.0', id: 1, result: { data } } }
}

test('a check-in without the player header is 401 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(req({}, {}))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('an unknown player is 404 before any chain read', async () => {
  net = installFakeNet((c) => (c.resource === 'players' ? rows() : undefined))
  const res = await POST(req())
  assert.equal(res.status, 404)
  assert.equal(net.node('getAccountByAddress').length, 0)
})

test('a player without a vault is 409 vault_required — never a client-reported balance', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(PLAYER_ROW)
    if (c.resource === 'vaults') return rows()
    return undefined
  })

  // A body claiming a huge balance changes nothing.
  const res = await POST(req({ balanceLuna: 999_999_999_999 }))
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'vault_required' })
  assert.equal(net.node('getAccountByAddress').length, 0)
  assert.equal(net.to('check_ins').length, 0)
})

test('an RPC outage is a 503 and writes no check-in', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(PLAYER_ROW)
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.nodeMethod === 'getAccountByAddress') throw new Error('ECONNREFUSED')
    return undefined
  })

  const res = await POST(req())
  assert.equal(res.status, 503)
  const body = (await res.json()) as { error: string }
  assert.equal(body.error, 'rpc_unreachable')
  assert.equal(net.to('check_ins').length, 0)
  assert.equal(net.to('players').filter((c) => c.method === 'PATCH').length, 0)
})

test('the body is never parsed — a garbage body still reaches the chain read', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(PLAYER_ROW)
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.nodeMethod === 'getAccountByAddress') throw new Error('ECONNREFUSED')
    return undefined
  })

  // If the handler called req.json(), this would be a 422 or 500. It is a 503
  // because the only thing that failed is the chain read.
  const res = await POST(req('{not json'))
  assert.equal(res.status, 503)
  assert.equal(net.node('getAccountByAddress').length, 1)
})

test('the balance comes from the vault account and the body cannot override it', async () => {
  const chainBalance = 12_345_678
  net = installFakeNet((c) => {
    // Count queries (`head: true`) carry no rows.
    if (c.method === 'HEAD') return { json: [] }
    if (c.resource === 'players' && c.method === 'GET') return rows(PLAYER_ROW)
    if (c.resource === 'players') return rows()
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.method === 'GET') return rows() // history, items, missions, ledger, badges
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: chainBalance, type: 'basic' })
    }
    return rows() // inserts / updates
  })

  const res = await POST(req({ balanceLuna: 999_999_999_999, balance: 999_999_999_999 }))
  assert.equal(res.status, 200)

  const body = (await res.json()) as { balanceLuna: number; ok: boolean }
  assert.equal(body.ok, true)
  assert.equal(body.balanceLuna, chainBalance)

  // The chain read targeted the vault, never the player's identity address.
  const account = net.node('getAccountByAddress')[0]
  assert.deepEqual((account.body as { params: unknown[] }).params, [VAULT])

  // The inserted snapshot is the chain balance, not the claim.
  const inserted = net.to('check_ins').find((c) => c.method === 'POST')!
  assert.equal((inserted.body as { balance_luna: number }).balance_luna, chainBalance)
})
