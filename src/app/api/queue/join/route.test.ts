/**
 * POST /api/queue/join - ranked eligibility.
 *
 * The release gate derives `players.check_in_count` from distinct UTC days.
 * This route is the consumer of that count; a player with four days must not
 * enter the queue even if their level is 3.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { authRequest } from '@/test/session'
import { POST } from '@/app/api/queue/join/route'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const VAULT_LOW = 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111'
const VAULT_OK = 'NQ07 2222 2222 2222 2222 2222 2222 2222 2222'

function chain(balance: number) {
  return { json: { jsonrpc: '2.0', id: 1, result: { data: { balance, type: 'basic' } } } }
}

const BASE_PLAYER = {
  address: PLAYER,
  level: 3,
  check_in_count: 5,
  bracket: 'entry',
  rating: 1000,
}

let net: FakeNet
afterEach(() => net?.restore())

function req(headers: Record<string, string> = { 'X-Player-Address': PLAYER }): Request {
  return authRequest('http://test/api/queue/join', { method: 'POST', headers })
}

test('no player header is 401', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(req({}))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('four distinct-day check-ins do not unlock ranked', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ ...BASE_PLAYER, check_in_count: 4 })
    return undefined
  })

  const res = await POST(req())
  assert.equal(res.status, 403)
  const body = (await res.json()) as { error: string }
  assert.match(body.error, /5 check-ins/)
  assert.equal(net.to('queue').length, 0)
})

test('an on-chain balance below 1 NIM does not unlock ranked', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ ...BASE_PLAYER, bracket: null })
    if (c.resource === 'vaults') return rows({ address: VAULT_LOW, network: 'testnet' })
    if (c.nodeMethod === 'getAccountByAddress') return chain(0)
    return undefined
  })

  const res = await POST(req())
  assert.equal(res.status, 403)
  assert.equal(net.to('queue').length, 0)
})

test('level 3 with five claimed days and 30 NIM joins with the chain bracket', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(BASE_PLAYER)
    if (c.resource === 'vaults') return rows({ address: VAULT_OK, network: 'testnet' })
    if (c.resource === 'daily_battles') return rows()
    if (c.resource === 'battles') return rows()
    if (c.resource === 'queue') return rows()
    if (c.nodeMethod === 'getAccountByAddress') return chain(30_000_000)
    return undefined
  })

  const res = await POST(req())
  assert.equal(res.status, 201)
  const body = (await res.json()) as { ok: boolean; waiting: boolean }
  assert.deepEqual(body, { ok: true, waiting: true })

  const upsert = net.to('queue').find((c) => c.method === 'POST')!
  assert.equal((upsert.body as { player_address: string }).player_address, PLAYER)
  assert.equal((upsert.body as { status: string }).status, 'waiting')
  assert.equal((upsert.body as { bracket: string }).bracket, 'gold')
  assert.equal(net.node('getAccountByAddress').length, 1)
})
