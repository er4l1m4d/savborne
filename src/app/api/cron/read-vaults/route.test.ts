/**
 * GET /api/cron/read-vaults - the daily standing snapshot.
 *
 * It is server-to-server only: no player header is authority, and a missing or
 * wrong CRON_SECRET is a 401 before any query. A good run records readings
 * without any reward fields, and one failing vault never aborts the batch.
 */

import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeCall, type FakeNet, type FakeReply } from '@/test/fake-net'
import { GET } from '@/app/api/cron/read-vaults/route'

const SECRET = 'test-cron-secret'
const VAULT_A = 'NQ07 AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA'
const VAULT_B = 'NQ07 BBBB BBBB BBBB BBBB BBBB BBBB BBBB BBBB'

let net: FakeNet
const original = process.env.CRON_SECRET

before(() => {
  process.env.CRON_SECRET = SECRET
})
after(() => {
  if (original === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original
})
afterEach(() => net?.restore())

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/cron/read-vaults', {
    headers: { authorization: `Bearer ${SECRET}`, ...headers },
  })
}

function vaultRows(): Record<string, unknown>[] {
  return [
    { address: VAULT_A, player_address: 'PLAYER_A', network: 'testnet' },
    { address: VAULT_B, player_address: 'PLAYER_B', network: 'testnet' },
  ]
}

function chain(balance: number): FakeReply {
  return { json: { jsonrpc: '2.0', id: 1, result: { data: { balance, type: 'basic' } } } }
}

test('no secret is a 401 before any query', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await GET(new Request('http://test/api/cron/read-vaults'))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('a wrong secret and a player header are both rejected', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })

  const wrong = await GET(req({ authorization: 'Bearer nope' }))
  assert.equal(wrong.status, 401)

  const player = await GET(
    req({ authorization: '', 'X-Player-Address': 'NQ07 AAAA AAAA AAAA AAAA AAAA AAAA AAAA AAAA' }),
  )
  assert.equal(player.status, 401)
  assert.equal(net.calls.length, 0)
})

test('a page records every vault with a bracket and no reward fields', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'cron_state' && c.method === 'GET') return rows()
    if (c.resource === 'cron_state') return { json: {} }
    if (c.resource === 'vaults') return rows(...vaultRows())
    if (c.nodeMethod === 'getAccountByAddress') return chain(30_000_000)
    if (c.rpc === 'record_reading') {
      return { json: { recorded: true, withdrawal: false, bracket: 'gold' } }
    }
    return undefined
  })

  const res = await GET(req())
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    ok: boolean
    processed: number
    recorded: number
    failed: number
    incomplete: boolean
  }

  assert.equal(body.ok, true)
  assert.equal(body.processed, 2)
  assert.equal(body.recorded, 2)
  assert.equal(body.failed, 0)
  assert.equal(body.incomplete, false)
  assert.equal(net.node('getAccountByAddress').length, 2)

  const calls = net.calls.filter((c) => c.rpc === 'record_reading')
  assert.equal(calls.length, 2)
  for (const call of calls) {
    const keys = Object.keys(call.body as Record<string, unknown>).sort()
    assert.deepEqual(keys, ['p_address', 'p_balance_luna', 'p_bracket', 'p_recorded_at'])
    assert.equal((call.body as { p_bracket: string }).p_bracket, 'gold')
    assert.equal((call.body as { p_balance_luna: number }).p_balance_luna, 30_000_000)
  }
})

test('one failing vault does not abort the rest', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'cron_state' && c.method === 'GET') return rows()
    if (c.resource === 'cron_state') return { json: {} }
    if (c.resource === 'vaults') return rows(...vaultRows())
    if (c.nodeMethod === 'getAccountByAddress') {
      const address = (c.body as { params: string[] }).params[0]
      if (address === VAULT_A) throw new Error('unreachable')
      return chain(5_000_000)
    }
    if (c.rpc === 'record_reading') {
      return { json: { recorded: true, withdrawal: false, bracket: 'bronze' } }
    }
    return undefined
  })

  const res = await GET(req())
  assert.equal(res.status, 200)
  const body = (await res.json()) as { processed: number; recorded: number; failed: number }
  assert.equal(body.processed, 2)
  assert.equal(body.recorded, 1)
  assert.equal(body.failed, 1)
})

test('a saved cursor is used and cleared after the last page', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'cron_state' && c.method === 'GET') {
      return rows({ cursor: VAULT_A })
    }
    if (c.resource === 'cron_state') return { json: {} }
    if (c.resource === 'vaults') return rows(vaultRows()[1])
    if (c.nodeMethod === 'getAccountByAddress') return chain(1_000_000)
    if (c.rpc === 'record_reading') {
      return { json: { recorded: true, withdrawal: false, bracket: 'entry' } }
    }
    return undefined
  })

  const res = await GET(req())
  assert.equal(res.status, 200)

  const vaultQuery = net.to('vaults').find((c: FakeCall) => c.method === 'GET')
  assert.ok(vaultQuery)
  assert.equal(vaultQuery.query.get('address'), `gt.${VAULT_A}`)

  const saves = net.to('cron_state').filter((c) => c.method !== 'GET')
  assert.equal(saves.length, 1)
  assert.equal((saves[0].body as { cursor: string | null }).cursor, null)
})
