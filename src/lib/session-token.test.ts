/**
 * Session token - issue, verify, tamper, expiry, wrong secret.
 *
 * The token is the only thing standing between a known address and a player's
 * state, so its failure modes are pinned here rather than discovered in
 * production.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

import {
  issueSessionToken,
  verifySessionToken,
  SESSION_TTL_MS,
} from '@/lib/session-token'

const ADDRESS = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const SECRET = 'test-session-secret-with-at-least-32-bytes'

const original = process.env.SESSION_SECRET
before(() => {
  process.env.SESSION_SECRET = SECRET
})
after(() => {
  if (original === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = original
})

test('a fresh token verifies to the normalised address and its expiry', () => {
  const now = 1_800_000_000_000
  const { token, expiresAt } = issueSessionToken(ADDRESS, now)

  assert.equal(expiresAt, now + SESSION_TTL_MS)
  const result = verifySessionToken(token, now)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.address, ADDRESS)
    assert.equal(result.expiresAt, expiresAt)
  }
})

test('a token expires exactly at exp', () => {
  const now = 1_800_000_000_000
  const { token, expiresAt } = issueSessionToken(ADDRESS, now)

  assert.equal(verifySessionToken(token, expiresAt - 1).ok, true)
  const expired = verifySessionToken(token, expiresAt)
  assert.deepEqual(expired, { ok: false, reason: 'expired' })
})

test('changing the payload invalidates the signature', () => {
  const { token } = issueSessionToken(ADDRESS, 1_800_000_000_000)
  const [payload, signature] = token.split('.')
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  decoded.addr = 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111'
  const forged = Buffer.from(JSON.stringify(decoded)).toString('base64url')

  assert.deepEqual(verifySessionToken(`${forged}.${signature}`), {
    ok: false,
    reason: 'bad_signature',
  })
})

test('a token signed with another secret is rejected', () => {
  const { token } = issueSessionToken(ADDRESS, 1_800_000_000_000)
  process.env.SESSION_SECRET = 'another-secret-that-is-also-32-bytes-long'
  assert.deepEqual(verifySessionToken(token, 1_800_000_000_000), {
    ok: false,
    reason: 'bad_signature',
  })
  process.env.SESSION_SECRET = SECRET
})

test('malformed tokens never throw', () => {
  for (const token of ['', 'abc', 'a.b.c', '!!!.???', '.', 'abc.def']) {
    const result = verifySessionToken(token, 1_800_000_000_000)
    assert.equal(result.ok, false)
  }
})

test('issuing without a long enough secret throws instead of weakening', () => {
  process.env.SESSION_SECRET = 'short'
  assert.throws(() => issueSessionToken(ADDRESS), /SESSION_SECRET/)
  process.env.SESSION_SECRET = SECRET
})
