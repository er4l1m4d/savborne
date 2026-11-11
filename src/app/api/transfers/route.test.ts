/**
 * Task 8 — /api/transfers route boundaries.
 *
 * These run the REAL handler against a fake network (src/test/fake-net.ts), so
 * they exercise the real supabase-js queries, the real settle call, and the
 * real status codes.
 *
 * The invariants that move money:
 *   • a client-supplied hash is a CLAIM — ownership of a hash is single, and
 *     another player's row is never serialized
 *   • the backup gate blocks deposits only, and cannot be bypassed by the body
 *   • the claim's network must match the vault's network
 *   • GET never touches the chain (listing must stay fast)
 *   • an RPC hiccup leaves the transfer `pending`, not failed
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, nodeTx, rows, type FakeNet, type FakeReply } from '@/test/fake-net'
import { authRequest } from '@/test/session'
import { GET, POST } from '@/app/api/transfers/route'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const OTHER_PLAYER = 'NQ39 2E6C 6A22 6B11 0000 0000 0000 0000 0000 0000'
const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'
const HASH = 'ab'.repeat(32)

/** `created_at` must be recent or the settle logic treats the claim as stale. */
function justNow(): string {
  return new Date().toISOString()
}

const VAULT_ROW = {
  address: VAULT,
  player_address: PLAYER,
  network: 'testnet',
  card_token: '11111111-1111-4111-8111-111111111111',
  backup_verified_at: '2026-11-02T00:00:00.000Z' as string | null,
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
    created_at: justNow(),
    confirmed_at: null,
    ...overrides,
  }
}

const CLAIM = { direction: 'in', txHash: HASH, amountLuna: 100_000, network: 'testnet' }

let net: FakeNet
afterEach(() => net?.restore())

function getReq(headers: Record<string, string> = {}): Request {
  return authRequest('http://test/api/transfers', { headers })
}

function postReq(body: unknown, headers: Record<string, string> = { 'X-Player-Address': PLAYER }): Request {
  return authRequest('http://test/api/transfers', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** A JSON-RPC reply from the Nimiq node. */
function rpc(data: unknown): FakeReply {
  return { json: { jsonrpc: '2.0', id: 1, result: { data } } }
}

function rpcNotFound(): FakeReply {
  return {
    json: {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'Transaction not found', data: 'Transaction not found' },
    },
  }
}

// ─── GET ────────────────────────────────────────────────────────────────────

test('GET without a player header is 401 and never queries', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await GET(getReq())
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('GET lists the caller\'s transfers and never touches the chain', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'transfers') {
      return rows(
        transferRow({ id: 1, status: 'pending', confirmed_at: null }),
        transferRow({ id: 2, status: 'included', block_height: 15_709_650, confirmed_at: justNow() }),
      )
    }
    if (c.resource === 'vaults') return rows({ network: 'testnet' })
    return undefined
  })

  const res = await GET(getReq({ 'X-Player-Address': PLAYER }))
  assert.equal(res.status, 200)

  const body = (await res.json()) as { transfers: Array<Record<string, unknown>> }
  assert.equal(body.transfers.length, 2)
  assert.equal(body.transfers[0].explorerUrl, null) // pending has no receipt
  assert.equal(body.transfers[1].explorerUrl, `https://test.nimiq.watch/#${HASH}`)
  assert.equal(body.transfers[1].blockHeight, 15_709_650)

  // Scoped to the header address, newest first.
  const list = net.to('transfers')[0]
  assert.equal(list.query.get('player_address'), `eq.${PLAYER}`)
  assert.equal(list.query.get('order'), 'created_at.desc')
  assert.equal(list.query.get('limit'), '50')

  // No chain traffic at all.
  assert.equal(net.node('getTransactionByHash').length, 0)
  assert.equal(net.node('getAccountByAddress').length, 0)
})

test('GET falls back to mainnet explorer links when the player has no vault', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'transfers') {
      return rows(transferRow({ status: 'included', block_height: 1, confirmed_at: justNow() }))
    }
    if (c.resource === 'vaults') return rows()
    return undefined
  })

  const res = await GET(getReq({ 'X-Player-Address': PLAYER }))
  const body = (await res.json()) as { transfers: Array<{ explorerUrl: string }> }
  assert.equal(body.transfers[0].explorerUrl, `https://nimiq.watch/#${HASH}`)
})

// ─── POST: identity and shape ───────────────────────────────────────────────

test('POST without a player header is 401, even with a garbage body', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(authRequest('http://test/api/transfers', { method: 'POST', body: '{not json' }))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('POST rejects invalid JSON with 422 before any query', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(postReq('{not json'))
  assert.equal(res.status, 422)
  assert.equal(net.calls.length, 0)
})

test('POST rejects every malformed field with 422 before any query', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })

  const bad: unknown[] = [
    { ...CLAIM, direction: 'sideways' },
    { ...CLAIM, txHash: 'ab' },
    { ...CLAIM, txHash: 'zz'.repeat(32) },
    { ...CLAIM, amountLuna: 0 },
    { ...CLAIM, amountLuna: -5 },
    { ...CLAIM, amountLuna: 1.5 },
    { ...CLAIM, amountLuna: '100000' },
    { ...CLAIM, network: 'mainnnet' },
  ]
  for (const body of bad) {
    const res = await POST(postReq(body))
    assert.equal(res.status, 422, `expected 422 for ${JSON.stringify(body)}`)
  }
  assert.equal(net.calls.length, 0)
})

test('POST on an unknown player is 404 before touching a vault or the chain', async () => {
  net = installFakeNet((c) => (c.resource === 'players' ? rows() : undefined))
  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 404)
  assert.equal(net.to('vaults').length, 0)
  assert.equal(net.node('getTransactionByHash').length, 0)
})

test('POST without a vault is 409 vault_required — never a client-reported balance', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') return rows()
    return undefined
  })
  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'vault_required' })
  assert.equal(net.to('transfers').length, 0)
  assert.equal(net.node('getTransactionByHash').length, 0)
})

// ─── POST: the gates ────────────────────────────────────────────────────────

test('POST blocks a deposit when the backup was never verified', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') return rows({ ...VAULT_ROW, backup_verified_at: null })
    return undefined
  })
  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 403)
  assert.deepEqual(await res.json(), { error: 'backup_required' })
  assert.equal(net.to('transfers').length, 0)
  assert.equal(net.node('getTransactionByHash').length, 0)
})

test('POST allows a withdrawal even when the backup was never verified', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') {
      return c.query.get('player_address')
        ? rows({ ...VAULT_ROW, backup_verified_at: null })
        : rows({ address: VAULT, network: 'testnet' })
    }
    if (c.resource === 'transfers') {
      return c.method === 'POST'
        ? rows(transferRow({ direction: 'out' }))
        : undefined
    }
    if (c.nodeMethod === 'getTransactionByHash') return rpcNotFound()
    return undefined
  })

  const res = await POST(postReq({ ...CLAIM, direction: 'out' }))
  assert.equal(res.status, 202)
  assert.equal(net.to('transfers').filter((c) => c.method === 'POST').length, 1)
})

test('POST rejects a claim whose network does not match the vault', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') return rows(VAULT_ROW) // testnet
    return undefined
  })
  const res = await POST(postReq({ ...CLAIM, network: 'mainnet' }))
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'network_mismatch' })
  assert.equal(net.to('transfers').length, 0)
  assert.equal(net.node('getTransactionByHash').length, 0)
})

// ─── POST: hash ownership ───────────────────────────────────────────────────

test('POST never serializes another player\'s transfer when a hash is already owned', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') return rows(VAULT_ROW)
    if (c.resource === 'transfers' && c.method === 'POST') {
      return {
        status: 409,
        json: { code: '23505', message: 'duplicate key value violates unique constraint' },
      }
    }
    if (c.resource === 'transfers') {
      return rows(
        transferRow({
          id: 99,
          player_address: OTHER_PLAYER,
          amount_luna: 987_654,
          status: 'included',
          block_height: 15_000_000,
        }),
      )
    }
    return undefined
  })

  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 409)
  const body = await res.json()
  assert.deepEqual(body, { error: 'tx_hash_conflict' })
  // Nothing about the other player's transfer leaks.
  const text = JSON.stringify(body)
  assert.equal(text.includes(OTHER_PLAYER), false)
  assert.equal(text.includes('987654'), false)
  // And the chain was never asked about a hash we do not own.
  assert.equal(net.node('getTransactionByHash').length, 0)
})

test('POST treats a replayed hash owned by the same player as an idempotent 200', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') return rows(VAULT_ROW)
    if (c.resource === 'transfers' && c.method === 'POST') {
      return {
        status: 409,
        json: { code: '23505', message: 'duplicate key value violates unique constraint' },
      }
    }
    if (c.resource === 'transfers') {
      // Already settled, so settle() must short-circuit and never poll.
      return rows(transferRow({ status: 'included', block_height: 15_709_650, confirmed_at: justNow() }))
    }
    return undefined
  })

  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 200)
  const body = (await res.json()) as { transfer: { status: string }; verified: boolean }
  assert.equal(body.transfer.status, 'included')
  assert.equal(body.verified, false) // nothing changed on this call
  assert.equal(net.node('getTransactionByHash').length, 0)
})

test('POST lowercases the hash it stores', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') return rows(VAULT_ROW)
    if (c.resource === 'transfers' && c.method === 'POST') return rows(transferRow())
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.nodeMethod === 'getTransactionByHash') return rpcNotFound()
    return undefined
  })

  await POST(postReq({ ...CLAIM, txHash: HASH.toUpperCase() }))
  const insert = net.to('transfers').find((c) => c.method === 'POST')!
  assert.equal((insert.body as { tx_hash: string }).tx_hash, HASH)
  assert.equal((insert.body as { status: string }).status, 'pending')
})

// ─── POST: settlement ───────────────────────────────────────────────────────

test('POST returns 202 pending (not an error) when the chain does not know the hash yet', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') {
      return c.query.get('player_address') ? rows(VAULT_ROW) : rows({ address: VAULT, network: 'testnet' })
    }
    if (c.resource === 'transfers' && c.method === 'POST') return rows(transferRow())
    if (c.nodeMethod === 'getTransactionByHash') return rpcNotFound()
    return undefined
  })

  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 202)
  const body = (await res.json()) as { transfer: { status: string; explorerUrl: unknown }; verified: boolean }
  assert.equal(body.transfer.status, 'pending')
  assert.equal(body.transfer.explorerUrl, null)
  assert.equal(body.verified, false)
})

test('POST settles a verified deposit from chain data and returns a receipt', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') {
      return c.query.get('player_address') ? rows(VAULT_ROW) : rows({ address: VAULT, network: 'testnet' })
    }
    if (c.resource === 'transfers' && c.method === 'POST') return rows(transferRow())
    if (c.resource === 'transfers') {
      // The conditional update on `status = pending`.
      return rows(
        transferRow({
          status: 'included',
          block_height: 15_709_650,
          confirmed_at: justNow(),
        }),
      )
    }
    if (c.resource === 'player_items') return rows()
    if (c.nodeMethod === 'getTransactionByHash') return rpc(nodeTx())
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: 100_000, type: 'basic' })
    }
    return undefined
  })

  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 202)
  const body = (await res.json()) as {
    transfer: { status: string; explorerUrl: string; blockHeight: number }
    verified: boolean
  }
  assert.equal(body.transfer.status, 'included')
  assert.equal(body.transfer.blockHeight, 15_709_650)
  assert.equal(body.transfer.explorerUrl, `https://test.nimiq.watch/#${HASH}`)
  assert.equal(body.verified, true)

  // The settle update is guarded on pending, so two polls agree on one winner.
  const update = net.to('transfers').find((c) => c.method === 'PATCH')!
  assert.equal(update.query.get('id'), 'eq.7')
  assert.equal(update.query.get('status'), 'eq.pending')
})

test('POST marks a claim expired when the chain transaction does not match it', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') {
      return c.query.get('player_address') ? rows(VAULT_ROW) : rows({ address: VAULT, network: 'testnet' })
    }
    if (c.resource === 'transfers' && c.method === 'POST') return rows(transferRow())
    if (c.resource === 'transfers') {
      return rows(transferRow({ status: 'expired', failure_reason: 'wrong_amount' }))
    }
    if (c.nodeMethod === 'getTransactionByHash') return rpc(nodeTx({ value: 1 })) // claim said 100000
    return undefined
  })

  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 202)
  const body = (await res.json()) as {
    transfer: { status: string; failureReason: string; explorerUrl: unknown }
    verified: boolean
  }
  assert.equal(body.transfer.status, 'expired')
  assert.equal(body.transfer.failureReason, 'wrong_amount')
  assert.equal(body.transfer.explorerUrl, null)
  assert.equal(body.verified, false)
  // A failed verification must never credit the player.
  assert.equal(net.to('players').filter((c) => c.method === 'PATCH').length, 0)
})

test('POST keeps the transfer pending when the RPC is unreachable', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows({ address: PLAYER })
    if (c.resource === 'vaults') {
      return c.query.get('player_address') ? rows(VAULT_ROW) : rows({ address: VAULT, network: 'testnet' })
    }
    if (c.resource === 'transfers' && c.method === 'POST') return rows(transferRow())
    if (c.nodeMethod === 'getTransactionByHash') throw new Error('ECONNREFUSED')
    return undefined
  })

  const res = await POST(postReq(CLAIM))
  assert.equal(res.status, 202)
  const body = (await res.json()) as { transfer: { status: string }; verified: boolean }
  assert.equal(body.transfer.status, 'pending')
  assert.equal(body.verified, false)
  // Nothing was written after the RPC failure.
  assert.equal(net.to('transfers').filter((c) => c.method === 'PATCH').length, 0)
})
