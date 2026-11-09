/**
 * POST /api/battles/[id]/cancel - creator-only abandonment of an unanswered
 * friend challenge.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { POST } from './route'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const OTHER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

let net: FakeNet
afterEach(() => net?.restore())

function req(headers: Record<string, string> = { 'X-Player-Address': PLAYER }): Request {
  return new Request('http://test/api/battles/b1/cancel', { method: 'POST', headers })
}

const ctx = { params: Promise.resolve({ id: 'b1' }) }

test('no player header is 401', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(req({}), ctx)
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('a missing battle is 404', async () => {
  net = installFakeNet((c) => (c.resource === 'battles' ? rows() : undefined))
  const res = await POST(req(), ctx)
  assert.equal(res.status, 404)
})

test('a non-creator is 403', async () => {
  net = installFakeNet((c) =>
    c.resource === 'battles'
      ? rows({ id: 'b1', player_a: OTHER, player_b: null, status: 'pending' })
      : undefined,
  )
  const res = await POST(req(), ctx)
  assert.equal(res.status, 403)
})

test('an active or accepted challenge is 409', async () => {
  for (const battle of [
    { id: 'b1', player_a: PLAYER, player_b: OTHER, status: 'pending' },
    { id: 'b1', player_a: PLAYER, player_b: null, status: 'active' },
  ]) {
    net?.restore()
    net = installFakeNet((c) => (c.resource === 'battles' ? rows(battle) : undefined))
    const res = await POST(req(), ctx)
    assert.equal(res.status, 409)
  }
})

test('the creator cancels a pending challenge with one guarded update', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'battles' && c.method === 'GET') {
      return rows({ id: 'b1', player_a: PLAYER, player_b: null, status: 'pending' })
    }
    if (c.resource === 'battles' && c.method === 'PATCH') return rows({ id: 'b1' })
    return undefined
  })

  const res = await POST(req(), ctx)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })

  const patch = net.to('battles').find((c) => c.method === 'PATCH')!
  assert.deepEqual(patch.body, { status: 'abandoned' })
  assert.equal(patch.query.get('id'), 'eq.b1')
  assert.equal(patch.query.get('status'), 'eq.pending')
  assert.equal(patch.query.get('player_b'), 'is.null')
})
