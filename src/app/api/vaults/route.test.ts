/**
 * Task 8 — /api/vaults route boundaries.
 *
 * These run the REAL route handlers against a fake network (see
 * src/test/fake-net.ts), so they exercise the actual supabase-js query
 * building, the actual status codes, and the actual DTO mapping.
 *
 * The invariants that matter:
 *   • identity comes only from the X-Player-Address header
 *   • card_token is minted server-side and ignores anything the client sends
 *   • a player who already has a vault cannot register a second one
 *   • a vault address owned by someone else is a 409, not a silent overwrite
 *   • PATCH can only move backup_verified_at from null to now
 */

import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { GET, POST, PATCH } from '@/app/api/vaults/route'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'

const VAULT_ROW = {
  address: VAULT,
  player_address: PLAYER,
  network: 'testnet' as const,
  card_token: '11111111-1111-4111-8111-111111111111',
  backup_verified_at: null as string | null,
  created_at: '2026-11-02T00:00:00.000Z',
}

let net: FakeNet

afterEach(() => net?.restore())

function req(body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/vaults', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('GET without a player header is 401 and never queries', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await GET(req())
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('GET returns { vault: null } for a player with no vault', async () => {
  net = installFakeNet((c) => (c.resource === 'vaults' ? rows() : undefined))
  const res = await GET(req(undefined, { 'X-Player-Address': PLAYER }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { vault: null })
  // The query is scoped to the header address.
  assert.equal(net.to('vaults')[0].query.get('player_address'), `eq.${PLAYER}`)
})

test('GET maps a row to a camelCase DTO and never exposes the phrase', async () => {
  net = installFakeNet((c) => (c.resource === 'vaults' ? rows(VAULT_ROW) : undefined))
  const res = await GET(req(undefined, { 'X-Player-Address': PLAYER }))
  const body = (await res.json()) as { vault: Record<string, unknown> }
  assert.deepEqual(body.vault, {
    address: VAULT,
    network: 'testnet',
    cardToken: VAULT_ROW.card_token,
    backupVerifiedAt: null,
    createdAt: VAULT_ROW.created_at,
  })
  assert.equal('phrase' in body.vault, false)
  assert.equal('blob' in body.vault, false)
})

test('POST without a header is 401', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(req({ vaultAddress: VAULT, network: 'testnet', backupVerified: true }))
  assert.equal(res.status, 401)
})

test('POST rejects a malformed vault address before any query', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(
    req({ vaultAddress: 'not-an-address', network: 'testnet', backupVerified: true }, { 'X-Player-Address': PLAYER }),
  )
  assert.equal(res.status, 400)
  assert.equal(net.calls.length, 0)
})

test('POST rejects an unknown network and a non-boolean backup flag', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const badNetwork = await POST(
    req({ vaultAddress: VAULT, network: 'mainnnet', backupVerified: true }, { 'X-Player-Address': PLAYER }),
  )
  assert.equal(badNetwork.status, 400)
  const badFlag = await POST(
    req({ vaultAddress: VAULT, network: 'testnet', backupVerified: 'yes' }, { 'X-Player-Address': PLAYER }),
  )
  assert.equal(badFlag.status, 400)
  assert.equal(net.calls.length, 0)
})

test('POST refuses a second vault for the same player with 409 has_vault', async () => {
  net = installFakeNet((c) => (c.resource === 'vaults' && c.method === 'GET' ? rows({ address: VAULT }) : undefined))
  const res = await POST(
    req({ vaultAddress: VAULT, network: 'testnet', backupVerified: true }, { 'X-Player-Address': PLAYER }),
  )
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'has_vault' })
  // No insert was attempted.
  assert.equal(net.to('vaults').filter((c) => c.method === 'POST').length, 0)
})

test('POST maps a duplicate vault address (23505) to 409 vault_taken', async () => {
  net = installFakeNet((c) => {
    if (c.resource !== 'vaults') return undefined
    if (c.method === 'GET') return rows() // player has no vault
    return {
      status: 409,
      json: { code: '23505', message: 'duplicate key value violates unique constraint "vaults_pkey"' },
    }
  })
  const res = await POST(
    req({ vaultAddress: VAULT, network: 'testnet', backupVerified: true }, { 'X-Player-Address': PLAYER }),
  )
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'vault_taken' })
})

test('POST mints card_token server-side and ignores a client-supplied one', async () => {
  net = installFakeNet((c) => {
    if (c.resource !== 'vaults') return undefined
    if (c.method === 'GET') return rows()
    return rows({ ...VAULT_ROW, card_token: 'server-minted' })
  })
  const res = await POST(
    req(
      {
        vaultAddress: VAULT,
        network: 'testnet',
        backupVerified: true,
        cardToken: 'attacker-chosen',
      },
      { 'X-Player-Address': PLAYER },
    ),
  )
  assert.equal(res.status, 201)
  const insert = net.to('vaults').find((c) => c.method === 'POST')!
  const sentBody = insert.body as Record<string, unknown>
  assert.notEqual(sentBody.card_token, 'attacker-chosen')
  // It is a UUID, and it is not anything the client sent.
  assert.match(String(sentBody.card_token), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  assert.equal(sentBody.player_address, PLAYER)
  const body = (await res.json()) as { vault: { cardToken: string } }
  assert.equal(body.vault.cardToken, 'server-minted')
})

test('POST stores backupVerified=false as a null timestamp', async () => {
  net = installFakeNet((c) => {
    if (c.resource !== 'vaults') return undefined
    if (c.method === 'GET') return rows()
    return rows({ ...VAULT_ROW, backup_verified_at: null })
  })
  await POST(
    req({ vaultAddress: VAULT, network: 'testnet', backupVerified: false }, { 'X-Player-Address': PLAYER }),
  )
  const insert = net.to('vaults').find((c) => c.method === 'POST')!
  assert.equal((insert.body as { backup_verified_at: unknown }).backup_verified_at, null)
})

test('PATCH without a header is 401', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await PATCH(req({ backupVerified: true }))
  assert.equal(res.status, 401)
})

test('PATCH requires backupVerified to be exactly true', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await PATCH(req({ backupVerified: false }, { 'X-Player-Address': PLAYER }))
  assert.equal(res.status, 400)
  assert.equal(net.calls.length, 0)
})

test('PATCH moves backup_verified_at only from null, and scopes to the header player', async () => {
  net = installFakeNet((c) => {
    if (c.resource !== 'vaults') return undefined
    return rows({ ...VAULT_ROW, backup_verified_at: '2026-11-02T12:00:00.000Z' })
  })
  const res = await PATCH(req({ backupVerified: true }, { 'X-Player-Address': PLAYER }))
  assert.equal(res.status, 200)
  const patch = net.to('vaults')[0]
  assert.equal(patch.method, 'PATCH')
  assert.equal(patch.query.get('player_address'), `eq.${PLAYER}`)
  assert.equal(patch.query.get('backup_verified_at'), 'is.null')
  const body = (await res.json()) as { vault: { backupVerifiedAt: string } }
  assert.equal(body.vault.backupVerifiedAt, '2026-11-02T12:00:00.000Z')
})

test('PATCH is a 404 no_vault when the player has no vault', async () => {
  net = installFakeNet((c) => {
    if (c.resource !== 'vaults') return undefined
    return rows() // the guarded update matches nothing AND the fallback read is empty
  })
  const res = await PATCH(req({ backupVerified: true }, { 'X-Player-Address': PLAYER }))
  assert.equal(res.status, 404)
  assert.deepEqual(await res.json(), { error: 'no_vault' })
})

test('PATCH on an already-verified vault returns the current row, not an error', async () => {
  let reads = 0
  net = installFakeNet((c) => {
    if (c.resource !== 'vaults') return undefined
    if (c.method === 'PATCH') return rows() // guarded update matches nothing (already verified)
    reads++
    return rows({ ...VAULT_ROW, backup_verified_at: '2026-01-01T00:00:00.000Z' })
  })
  const res = await PATCH(req({ backupVerified: true }, { 'X-Player-Address': PLAYER }))
  assert.equal(res.status, 200)
  assert.equal(reads, 1)
  const body = (await res.json()) as { vault: { backupVerifiedAt: string } }
  assert.equal(body.vault.backupVerifiedAt, '2026-01-01T00:00:00.000Z')
})
