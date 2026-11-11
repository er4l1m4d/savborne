/**
 * requirePlayer - the single identity guard.
 *
 * A bare X-Player-Address is not authority. Only a valid, unexpired,
 * correctly-signed session token with a live player_sessions row identifies
 * the caller. Revocation is checked on every request.
 */

import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, type FakeNet } from '@/test/fake-net'
import { requirePlayer } from '@/lib/require-player'
import { issueSessionToken, SESSION_TTL_MS } from '@/lib/session-token'
import { PLAYER_HEADER, SESSION_HEADER } from '@/lib/session'

const ADDRESS = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const SECRET = 'test-session-secret-with-at-least-32-bytes'

let net: FakeNet
const original = process.env.SESSION_SECRET
before(() => {
  process.env.SESSION_SECRET = SECRET
})
after(() => {
  if (original === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = original
})
afterEach(() => net?.restore())

function req(headers: Record<string, string>): Request {
  return new Request('http://test/api/profile', { headers })
}

test('a bare player header is rejected', async () => {
  const result = await requirePlayer(req({ [PLAYER_HEADER]: ADDRESS }))
  assert.ok(result instanceof Response)
  assert.equal(result.status, 401)
})

test('a valid token with a live session identifies the player', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'session_is_active' ? { json: true } : undefined,
  )
  const { token, sessionId } = issueSessionToken(ADDRESS)
  const result = await requirePlayer(req({ [SESSION_HEADER]: token }))
  assert.equal('address' in result, true)
  if ('address' in result) {
    assert.equal(result.address, ADDRESS)
    assert.equal(result.sessionId, sessionId)
  }
})

test('an expired token is session_expired', async () => {
  const { token } = issueSessionToken(ADDRESS, Date.now() - SESSION_TTL_MS - 1_000)
  const result = await requirePlayer(req({ [SESSION_HEADER]: token }))
  assert.ok(result instanceof Response)
  assert.equal(result.status, 401)
  assert.deepEqual(await result.json(), { error: 'session_expired' })
})

test('a tampered token is session_invalid', async () => {
  const { token } = issueSessionToken(ADDRESS)
  const result = await requirePlayer(req({ [SESSION_HEADER]: `${token}x` }))
  assert.ok(result instanceof Response)
  assert.equal(result.status, 401)
  assert.deepEqual(await result.json(), { error: 'session_invalid' })
})

test('a revoked session is rejected even though the HMAC is valid', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'session_is_active' ? { json: false } : undefined,
  )
  const { token } = issueSessionToken(ADDRESS)
  const result = await requirePlayer(req({ [SESSION_HEADER]: token }))
  assert.ok(result instanceof Response)
  assert.equal(result.status, 401)
  assert.deepEqual(await result.json(), { error: 'session_revoked' })
})

test('a token and player header for different wallets do not mix', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'session_is_active' ? { json: true } : undefined,
  )
  const { token } = issueSessionToken(ADDRESS)
  const result = await requirePlayer(
    req({
      [SESSION_HEADER]: token,
      [PLAYER_HEADER]: 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111',
    }),
  )
  assert.ok(result instanceof Response)
  assert.equal(result.status, 401)
  assert.deepEqual(await result.json(), { error: 'session_mismatch' })
})

test('a missing secret is a 503, never a bypass', async () => {
  delete process.env.SESSION_SECRET
  const result = await requirePlayer(req({ [SESSION_HEADER]: 'anything.anything' }))
  assert.ok(result instanceof Response)
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { error: 'session_unavailable' })
})
