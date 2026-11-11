/**
 * GET /api/health - the schema-version contract.
 *
 * Production broke once because the deployed code and the database could drift
 * apart with no signal: every check-in returned a PostgREST "schema cache"
 * 500. This route is the cheap, secret-free probe that makes that drift
 * visible: it reports the database's own version marker and whether the two
 * release-gate RPCs exist.
 *
 * A 200 is only honest when the database is reachable, the reported version
 * matches the version this build expects, and both RPCs are present. Every
 * other state is a 503 with `ok:false` and the specific check that failed.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, type FakeNet, type FakeReply } from '@/test/fake-net'
import { GET } from '@/app/api/health/route'
import { EXPECTED_SCHEMA_VERSION } from '@/lib/schema'

let net: FakeNet
afterEach(() => net?.restore())

function healthReply(overrides: Record<string, unknown> = {}): FakeReply {
  return {
    json: {
      version: EXPECTED_SCHEMA_VERSION,
      commitCheckIn: true,
      consumeRateLimit: true,
      recordReading: true,
      settleBattle: true,
      sessionIsActive: true,
      ...overrides,
    },
  }
}

test('a matching schema returns 200 and the full contract', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'schema_health' ? healthReply() : undefined,
  )

  const res = await GET()
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.deepEqual(body, {
    ok: true,
    schemaVersion: EXPECTED_SCHEMA_VERSION,
    expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    checks: {
      db: true,
      checkInRpc: true,
      rateLimitRpc: true,
      recordReadingRpc: true,
      settleBattleRpc: true,
      sessionRpc: true,
    },
  })
})

test('a stale schema version returns 503 but still reports the database is up', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'schema_health'
      ? healthReply({ version: '2026-10-01.1' })
      : undefined,
  )

  const res = await GET()
  const body = await res.json()

  assert.equal(res.status, 503)
  assert.equal(body.ok, false)
  assert.equal(body.schemaVersion, '2026-10-01.1')
  assert.equal(body.expectedSchemaVersion, EXPECTED_SCHEMA_VERSION)
  assert.deepEqual(body.checks, {
    db: true,
    checkInRpc: true,
    rateLimitRpc: true,
    recordReadingRpc: true,
    settleBattleRpc: true,
    sessionRpc: true,
  })
})

test('a missing release-gate RPC returns 503 and names the missing check', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'schema_health'
      ? healthReply({ commitCheckIn: false })
      : undefined,
  )

  const res = await GET()
  const body = await res.json()

  assert.equal(res.status, 503)
  assert.equal(body.ok, false)
  assert.deepEqual(body.checks, {
    db: true,
    checkInRpc: false,
    rateLimitRpc: true,
    recordReadingRpc: true,
    settleBattleRpc: true,
    sessionRpc: true,
  })
})

test('a database without schema_health is reachable but unversioned: 503', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'schema_health'
      ? {
          status: 404,
          json: {
            code: 'PGRST202',
            message: 'Could not find the function public.schema_health',
          },
        }
      : undefined,
  )

  const res = await GET()
  const body = await res.json()

  assert.equal(res.status, 503)
  assert.equal(body.ok, false)
  assert.equal(body.schemaVersion, null)
  assert.deepEqual(body.checks, {
    db: true,
    checkInRpc: false,
    rateLimitRpc: false,
    recordReadingRpc: false,
    settleBattleRpc: false,
    sessionRpc: false,
  })
})

test('an unreachable database returns 503 with db:false and leaks no internals', async () => {
  net = installFakeNet(() => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432 secret-host')
  })

  const res = await GET()
  const text = await res.text()
  const body = JSON.parse(text)

  assert.equal(res.status, 503)
  assert.equal(body.ok, false)
  assert.deepEqual(body.checks, {
    db: false,
    checkInRpc: false,
    rateLimitRpc: false,
    recordReadingRpc: false,
    settleBattleRpc: false,
    sessionRpc: false,
  })
  assert.doesNotMatch(text, /ECONNREFUSED|5432|secret-host|schema cache|public\./i)
})


test('a missing session RPC is a 503 even when the older checks pass', async () => {
  net = installFakeNet((call) =>
    call.rpc === 'schema_health'
      ? healthReply({ sessionIsActive: false })
      : undefined,
  )

  const res = await GET()
  const body = await res.json()

  assert.equal(res.status, 503)
  assert.equal(body.ok, false)
  assert.equal(body.checks.sessionRpc, false)
})
