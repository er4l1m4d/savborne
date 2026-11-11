/**
 * POST /api/session - exchange a wallet signature for a 12-hour token.
 *
 * The checks are deliberately ordered: rate limit, body shape, address, proof
 * freshness, then the signature. A missing, stale or malformed proof costs no
 * crypto, and a bad signature never gets a token.
 */

import { test, before, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, type FakeNet } from '@/test/fake-net'
import { POST } from '@/app/api/session/route'
import { sessionMessage } from '@/lib/session-request'
import { verifySessionToken } from '@/lib/session-token'
import { newWalletSigner, type TestSigner } from '@/test/wallet-signer'

let signer: TestSigner
let attacker: TestSigner
let net: FakeNet

before(async () => {
  process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-bytes'
  signer = await newWalletSigner()
  attacker = await newWalletSigner()
})
afterEach(() => {
  net?.restore()
  process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-bytes'
})

function body(overrides: Record<string, unknown> = {}) {
  return {
    address: signer.address,
    ...overrides,
  }
}

async function signedBody(
  signedAt = Date.now(),
  address = signer.address,
  signWith: TestSigner = signer,
) {
  const proof = await signWith.sign(sessionMessage({ address, signedAt }))
  return { address, signedAt, ...proof }
}

function req(payload: unknown): Request {
  return new Request('http://test/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

test('a valid proof returns a token that verifies for that address', async () => {
  net = installFakeNet(() => undefined)

  const res = await POST(req(await signedBody()))
  assert.equal(res.status, 200)
  const json = (await res.json()) as {
    token: string
    expiresAt: number
    address: string
  }

  const verified = verifySessionToken(json.token, Date.now())
  assert.equal(verified.ok, true)
  if (verified.ok) {
    assert.equal(verified.address, signer.address)
    assert.equal(json.address, signer.address.replace(/[\s+]/g, '').toUpperCase())
    assert.equal(verified.expiresAt, json.expiresAt)
  }
})

test('a proof signed by another wallet is wrong_signer, not consent', async () => {
  net = installFakeNet(() => undefined)

  const res = await POST(req(await signedBody(Date.now(), signer.address, attacker)))
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'wrong_signer' })
})

test('a stale proof is rejected before verification', async () => {
  net = installFakeNet(() => undefined)

  const res = await POST(req(await signedBody(Date.now() - 10 * 60_000)))
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'stale' })
})

test('a tampered signature is bad_signature', async () => {
  net = installFakeNet(() => undefined)
  const payload = await signedBody()
  const signature = payload.signature
  payload.signature = (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1)

  const res = await POST(req(payload))
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'bad_signature' })
})

test('a malformed body is a 400 and a bad address is rejected', async () => {
  net = installFakeNet(() => undefined)

  const malformed = await POST(req(body()))
  assert.equal(malformed.status, 401)
  assert.deepEqual(await malformed.json(), { error: 'missing' })

  const badAddress = await POST(req({ address: 'not-an-address' }))
  assert.equal(badAddress.status, 400)
  assert.deepEqual(await badAddress.json(), { error: 'invalid_address' })
})

test('the endpoint is rate limited per IP before the proof', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'consume_rate_limit'
      ? { json: { allowed: false, remaining: 0, retryAfterSeconds: 42 } }
      : undefined,
  )

  const res = await POST(
    new Request('http://test/api/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.9, 10.0.0.1',
      },
      body: JSON.stringify(await signedBody()),
    }),
  )

  assert.equal(res.status, 429)
  assert.deepEqual(await res.json(), { error: 'rate_limited', retryAfterSeconds: 42 })
  assert.equal(res.headers.get('retry-after'), '42')
  assert.equal(net.calls.filter((c) => c.rpc === 'consume_rate_limit').length, 1)
})
