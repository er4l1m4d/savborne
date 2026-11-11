/**
 * Task 8 - POST /api/check-ins boundaries.
 *
 * The security claim this build exists to make: the balance is read from the
 * vault's chain account, never from the request. The integrity claim added by
 * the release gate: one reading per UTC day, an atomic commit, and a rate
 * limit before any expensive work. The trust claim added by this batch: the
 * address header is identity, and every POST must carry a wallet signature
 * whose key derives that address.
 *
 * Also covered: 401 / 404 / 409 vault_required / 429 rate_limited /
 * 503 rpc_unreachable / same-day idempotency / a lost commit race, and every
 * proof rejection (missing, malformed, stale, bad_signature, wrong_signer,
 * another action, another address) before any table or chain read.
 */

import { test, before, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeCall, type FakeNet, type FakeReply } from '@/test/fake-net'
import { POST } from '@/app/api/check-ins/route'
import { checkInAuthHeaders, checkInMessage } from '@/lib/checkin-request'
import { newWalletSigner, type TestSigner } from '@/test/wallet-signer'
import { authRequest } from '@/test/session'

const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'

/**
 * A generated keypair's address, so the test can sign as the player. Assigned
 * in `before` because there is no top-level await in this CommonJS transform.
 */
let PLAYER = ''
let signer: TestSigner
let attacker: TestSigner

before(async () => {
  signer = await newWalletSigner()
  attacker = await newWalletSigner()
  PLAYER = signer.address
})

/** The player row as the DB returns it; `address` is the generated signer. */
function playerRow(overrides: Record<string, unknown> = {}) {
  return {
    address: PLAYER,
    check_in_count: 0,
    xp: 0,
    level: 1,
    streak_current: 0,
    streak_best: 0,
    shields: 1,
    shields_earned: 0,
    bracket: null,
    current_balance_luna: 0,
    wins: 0,
    steady_hand_started_at: null,
    last_check_in_at: null,
    ...overrides,
  }
}

/** The 19 fields both success branches return. Pinned so a rename fails loudly. */
const SUCCESS_KEYS = [
  'alreadyCheckedIn',
  'awarded',
  'badgeActions',
  'balanceLuna',
  'bracket',
  'bracketChanged',
  'checkInCount',
  'leveledUp',
  'newLevel',
  'newXp',
  'ok',
  'previousBalanceLuna',
  'previousBracket',
  'shields',
  'shieldsEarned',
  'streakCurrent',
  'unlockedItems',
  'withdrawalDetected',
  'xpToNext',
]

let net: FakeNet
afterEach(() => net?.restore())

function req(
  body: unknown = {},
  headers: Record<string, string> = { 'X-Player-Address': PLAYER },
): Request {
  return authRequest('http://test/api/check-ins', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** The three headers a signing client sends, over the message it signs. */
async function proofHeaders(address = PLAYER, signedAt = Date.now()) {
  const proof = await signer.sign(checkInMessage({ address, signedAt }))
  return checkInAuthHeaders({ ...proof, signedAt })
}

/** A request that carries a valid, fresh proof for the player. */
async function signedReq(body: unknown = {}, extra: Record<string, string> = {}) {
  return req(body, { 'X-Player-Address': PLAYER, ...(await proofHeaders()), ...extra })
}

function rpc(data: unknown): FakeReply {
  return { json: { jsonrpc: '2.0', id: 1, result: { data } } }
}

/** The two release-gate RPCs every reaching request must get past. */
function gate(call: FakeCall, commit: FakeReply = { json: { claimed: true, check_in_count: 1 } }): FakeReply | undefined {
  if (call.rpc === 'consume_rate_limit') {
    return { json: { allowed: true, remaining: 9, retryAfterSeconds: 0 } }
  }
  if (call.rpc === 'commit_check_in') return commit
  return undefined
}

// ─── Proof gate: rejected before any I/O ─────────────────────────────────────

test('a check-in without the player header is 401 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(req({}, {}))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('a check-in with no proof headers is 401 missing and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await POST(req())
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'missing' })
  assert.equal(net.calls.length, 0)
})

test('a malformed proof is 400 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const proof = await proofHeaders()
  const res = await POST(
    req({}, {
      'X-Player-Address': PLAYER,
      ...proof,
      'X-Savborne-Check-In-Public-Key': 'zz'.repeat(32),
    }),
  )
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'malformed' })
  assert.equal(net.calls.length, 0)
})

test('a stale proof is 401 and never reaches the rate limit', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const signedAt = Date.now() - 125_000
  const res = await POST(
    req({}, { 'X-Player-Address': PLAYER, ...(await proofHeaders(PLAYER, signedAt)) }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'stale' })
  assert.equal(net.calls.length, 0)
})

test('a bad signature is 401 after the rate limit and before any table read', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') return { json: { allowed: true } }
    return undefined
  })
  const proof = await proofHeaders()
  const res = await POST(
    req({}, {
      'X-Player-Address': PLAYER,
      ...proof,
      // A real key, but not the one that signed these bytes.
      'X-Savborne-Check-In-Public-Key': attacker.publicKey,
    }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'bad_signature' })
  assert.equal(net.calls.filter((c) => c.rpc === 'consume_rate_limit').length, 1)
  assert.equal(net.to('players').length, 0)
  assert.equal(net.to('vaults').length, 0)
  assert.equal(net.node('getAccountByAddress').length, 0)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
})

test('a valid signature from a key that does not control the address is wrong_signer', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') return { json: { allowed: true } }
    return undefined
  })
  // The attacker signs a message naming the player, with their own key.
  const signedAt = Date.now()
  const proof = await attacker.sign(checkInMessage({ address: PLAYER, signedAt }))

  const res = await POST(
    req({}, { 'X-Player-Address': PLAYER, ...checkInAuthHeaders({ ...proof, signedAt }) }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'wrong_signer' })
  assert.equal(net.to('players').length, 0)
  assert.equal(net.node('getAccountByAddress').length, 0)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
})

test('a proof signed for a different action is rejected', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') return { json: { allowed: true } }
    return undefined
  })
  const signedAt = Date.now()
  const proof = await signer.sign(
    checkInMessage({ address: PLAYER, action: 'claim', signedAt }),
  )
  const res = await POST(
    req({}, { 'X-Player-Address': PLAYER, ...checkInAuthHeaders({ ...proof, signedAt }) }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'bad_signature' })
  assert.equal(net.to('players').length, 0)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
})

test('a proof signed for a different address is rejected', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') return { json: { allowed: true } }
    return undefined
  })
  // Signed over another address, sent with this player's header.
  const signedAt = Date.now()
  const proof = await signer.sign(checkInMessage({ address: attacker.address, signedAt }))
  const res = await POST(
    req({}, { 'X-Player-Address': PLAYER, ...checkInAuthHeaders({ ...proof, signedAt }) }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'bad_signature' })
  assert.equal(net.to('players').length, 0)
})

// ─── The existing pipeline ───────────────────────────────────────────────────

test('a valid proof runs the check-in path exactly once', async () => {
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.method === 'HEAD') return { json: [] }
    if (c.resource === 'players' && c.method === 'GET') return rows(playerRow())
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') return rows()
    if (c.method === 'GET') return rows()
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: 100_000, type: 'basic' })
    }
    return rows()
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 200)
  const body = (await res.json()) as { ok: boolean; alreadyCheckedIn: boolean }
  assert.equal(body.ok, true)
  assert.equal(body.alreadyCheckedIn, false)
  assert.equal(net.node('getAccountByAddress').length, 1)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 1)
})

test('the success response keeps exactly the same 19 fields', async () => {
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.method === 'HEAD') return { json: [] }
    if (c.resource === 'players' && c.method === 'GET') return rows(playerRow())
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') return rows()
    if (c.method === 'GET') return rows()
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: 100_000, type: 'basic' })
    }
    return rows()
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 200)
  const body = (await res.json()) as Record<string, unknown>
  assert.deepEqual(Object.keys(body).sort(), SUCCESS_KEYS)
})

test('the already-checked-in response keeps exactly the same 19 fields', async () => {
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.resource === 'players') {
      return rows(
        playerRow({
          check_in_count: 3,
          current_balance_luna: 500_000,
          xp: 120,
          level: 3,
          streak_current: 3,
          bracket: 'entry',
        }),
      )
    }
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') {
      return rows({ balance_luna: 500_000, recorded_at: new Date().toISOString() })
    }
    if (c.nodeMethod === 'getAccountByAddress') {
      throw new Error('duplicate check-in must not read the chain')
    }
    return undefined
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 200)
  const body = (await res.json()) as Record<string, unknown>
  assert.deepEqual(Object.keys(body).sort(), SUCCESS_KEYS)
  assert.equal(body.alreadyCheckedIn, true)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
})

test('an unknown player is 404 before any chain read', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') return { json: { allowed: true } }
    if (c.resource === 'players') return rows()
    return undefined
  })
  const res = await POST(await signedReq())
  assert.equal(res.status, 404)
  assert.equal(net.node('getAccountByAddress').length, 0)
})

test('a player without a vault is 409 vault_required - never a client-reported balance', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') return { json: { allowed: true } }
    if (c.resource === 'players') return rows(playerRow())
    if (c.resource === 'vaults') return rows()
    return undefined
  })

  // A body claiming a huge balance changes nothing.
  const res = await POST(await signedReq({ balanceLuna: 999_999_999_999 }))
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'vault_required' })
  assert.equal(net.node('getAccountByAddress').length, 0)
  assert.equal(net.to('check_ins').length, 0)
})

test('a denied rate limit is 429 before any player, vault or chain read', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') {
      return { json: { allowed: false, remaining: 0, retryAfterSeconds: 37 } }
    }
    return undefined
  })

  // A valid proof: the 429 must come from the gate, not from a bad signature.
  const res = await POST(await signedReq())
  assert.equal(res.status, 429)
  const body = (await res.json()) as { error: string; retryAfterSeconds: number }
  assert.deepEqual(body, { error: 'rate_limited', retryAfterSeconds: 37 })
  assert.equal(res.headers.get('retry-after'), '37')
  assert.equal(net.calls.filter((c) => c.rpc === 'consume_rate_limit').length, 1)
  assert.equal(net.to('players').length, 0)
  assert.equal(net.to('vaults').length, 0)
  assert.equal(net.node('getAccountByAddress').length, 0)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
})

test('a database failure is a stable db_error with no schema names in the body', async () => {
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') {
      return {
        status: 500,
        json: {
          code: '42P01',
          message: 'relation "api_rate_limits" does not exist',
          details: 'column key',
        },
      }
    }
    return undefined
  })

  const res = await POST(await signedReq())
  const text = await res.text()

  assert.equal(res.status, 500)
  assert.deepEqual(JSON.parse(text), { error: 'db_error' })
  assert.doesNotMatch(text, /api_rate_limits|relation|column|does not exist/i)
  assert.equal(net.to('players').length, 0)
})

test('an RPC outage is a 503 and writes no check-in', async () => {
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.resource === 'players') return rows(playerRow())
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') return rows()
    if (c.nodeMethod === 'getAccountByAddress') throw new Error('ECONNREFUSED')
    return undefined
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 503)
  const body = (await res.json()) as { error: string }
  assert.equal(body.error, 'rpc_unreachable')
  assert.equal(net.to('check_ins').filter((c) => c.method !== 'GET').length, 0)
  assert.equal(net.to('players').filter((c) => c.method !== 'GET').length, 0)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
})

test('the body is never parsed - a garbage body still reaches the chain read', async () => {
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.resource === 'players') return rows(playerRow())
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') return rows()
    if (c.nodeMethod === 'getAccountByAddress') throw new Error('ECONNREFUSED')
    return undefined
  })

  // If the handler called req.json(), this would be a 422 or 500. It is a 503
  // because the only thing that failed is the chain read.
  const res = await POST(await signedReq('{not json'))
  assert.equal(res.status, 503)
  assert.equal(net.node('getAccountByAddress').length, 1)
})

test('the balance comes from the vault account and the commit payload carries it', async () => {
  const chainBalance = 12_345_678
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.method === 'HEAD') return { json: [] }
    if (c.resource === 'players' && c.method === 'GET') return rows(playerRow())
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') return rows()
    if (c.method === 'GET') return rows() // items, missions, ledger, badges
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: chainBalance, type: 'basic' })
    }
    return rows()
  })

  const res = await POST(await signedReq({ balanceLuna: 999_999_999_999, balance: 999_999_999_999 }))
  assert.equal(res.status, 200)

  const body = (await res.json()) as {
    ok: boolean
    alreadyCheckedIn: boolean
    balanceLuna: number
    checkInCount: number
  }
  assert.equal(body.ok, true)
  assert.equal(body.alreadyCheckedIn, false)
  assert.equal(body.balanceLuna, chainBalance)
  assert.equal(body.checkInCount, 1)

  // The chain read targeted the vault, never the player's identity address.
  const account = net.node('getAccountByAddress')[0]
  assert.deepEqual((account.body as { params: unknown[] }).params, [VAULT])

  // The snapshot is the chain balance, not the claim.
  const commit = net.calls.find((c) => c.rpc === 'commit_check_in')!
  const payload = commit.body as {
    p_address: string
    p_balance_luna: number
    p_player: { current_balance_luna: number }
    p_daily_xp: number
  }
  assert.equal(payload.p_address, PLAYER)
  assert.equal(payload.p_balance_luna, chainBalance)
  assert.equal(payload.p_player.current_balance_luna, chainBalance)

  // The release gate owns every write. The route only reads tables.
  for (const table of [
    'check_ins',
    'players',
    'daily_xp',
    'player_missions',
    'player_items',
    'player_badges',
  ]) {
    const writes = net.to(table).filter((c) => c.method !== 'GET' && c.method !== 'HEAD')
    assert.equal(writes.length, 0, `${table} must not be written directly`)
  }
})

test('a second POST on the same UTC day is idempotent and skips the chain', async () => {
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.resource === 'players') {
      return rows(
        playerRow({
          check_in_count: 3,
          current_balance_luna: 500_000,
          xp: 120,
          level: 3,
          streak_current: 3,
          bracket: 'entry',
        }),
      )
    }
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') {
      return rows({ balance_luna: 500_000, recorded_at: new Date().toISOString() })
    }
    if (c.nodeMethod === 'getAccountByAddress') {
      throw new Error('duplicate check-in must not read the chain')
    }
    return undefined
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    ok: boolean
    alreadyCheckedIn: boolean
    awarded: unknown[]
    unlockedItems: unknown[]
    badgeActions: unknown[]
    checkInCount: number
    balanceLuna: number
    bracket: string
    bracketChanged: boolean
    withdrawalDetected: boolean
  }
  assert.equal(body.ok, true)
  assert.equal(body.alreadyCheckedIn, true)
  assert.deepEqual(body.awarded, [])
  assert.deepEqual(body.unlockedItems, [])
  assert.deepEqual(body.badgeActions, [])
  assert.equal(body.checkInCount, 3)
  assert.equal(body.balanceLuna, 500_000)
  assert.equal(body.bracket, 'entry')
  assert.equal(body.bracketChanged, false)
  assert.equal(body.withdrawalDetected, false)
  assert.equal(net.node('getAccountByAddress').length, 0)
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
})

test('a cron reading is claimed against the stored balance without a chain read', async () => {
  const readingAt = new Date().toISOString()
  net = installFakeNet((c) => {
    const g = gate(c, { json: { claimed: true, check_in_count: 4 } })
    if (g) return g
    if (c.resource === 'players') return rows(playerRow({ check_in_count: 3, bracket: 'silver' }))
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') {
      return rows({
        balance_luna: 30_000_000,
        recorded_at: readingAt,
        claimed_at: null,
        bracket: 'gold',
      })
    }
    if (c.nodeMethod === 'getAccountByAddress') {
      throw new Error('a stored cron reading must not trigger a chain read')
    }
    if (c.method === 'HEAD') return { json: [] }
    if (c.method === 'GET') return rows()
    return rows()
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    alreadyCheckedIn: boolean
    balanceLuna: number
    bracket: string
    checkInCount: number
  }

  assert.equal(body.alreadyCheckedIn, false)
  assert.equal(body.balanceLuna, 30_000_000)
  assert.equal(body.bracket, 'gold')
  assert.equal(body.checkInCount, 4)
  assert.equal(net.node('getAccountByAddress').length, 0)

  const commit = net.calls.find((c) => c.rpc === 'commit_check_in')
  assert.ok(commit)
  const payload = commit.body as {
    p_balance_luna: number
    p_player: { bracket: string }
  }
  assert.equal(payload.p_balance_luna, 30_000_000)
  assert.equal(payload.p_player.bracket, 'gold')
})

test('a second claim of the same cron reading returns alreadyCheckedIn with no awards', async () => {
  net = installFakeNet((c) => {
    if (gate(c)) return gate(c)
    if (c.resource === 'players') return rows(playerRow({ check_in_count: 4, bracket: 'gold' }))
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') {
      return rows({
        balance_luna: 30_000_000,
        recorded_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        bracket: 'gold',
      })
    }
    if (c.nodeMethod === 'getAccountByAddress') {
      throw new Error('an already-claimed day must not read the chain')
    }
    return undefined
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    alreadyCheckedIn: boolean
    awarded: unknown[]
    unlockedItems: unknown[]
    badgeActions: unknown[]
  }

  assert.equal(body.alreadyCheckedIn, true)
  assert.deepEqual(body.awarded, [])
  assert.deepEqual(body.unlockedItems, [])
  assert.deepEqual(body.badgeActions, [])
  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 0)
  assert.equal(net.node('getAccountByAddress').length, 0)
})

test('five POSTs on one UTC day commit exactly once and read the chain once', async () => {
  let committed = false
  net = installFakeNet((c) => {
    if (c.rpc === 'consume_rate_limit') return { json: { allowed: true } }
    if (c.rpc === 'commit_check_in') {
      committed = true
      return { json: { claimed: true, check_in_count: 1 } }
    }
    if (c.resource === 'players') {
      return rows(playerRow({ check_in_count: committed ? 1 : 0 }))
    }
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') {
      return committed
        ? rows({ balance_luna: 100_000, recorded_at: new Date().toISOString() })
        : rows()
    }
    if (c.method === 'HEAD') return { json: [] }
    if (c.method === 'GET') return rows()
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: 100_000, type: 'basic' })
    }
    return rows()
  })

  for (let i = 0; i < 5; i++) {
    const res = await POST(await signedReq())
    assert.equal(res.status, 200)
  }

  assert.equal(net.calls.filter((c) => c.rpc === 'commit_check_in').length, 1)
  assert.equal(net.node('getAccountByAddress').length, 1)
})

test('losing the commit race returns the idempotent shape with no awards', async () => {
  net = installFakeNet((c) => {
    if (gate(c, { json: { claimed: false, check_in_count: 1 } })) {
      return gate(c, { json: { claimed: false, check_in_count: 1 } })
    }
    if (c.method === 'HEAD') return { json: [] }
    if (c.resource === 'players') return rows(playerRow())
    if (c.resource === 'vaults') return rows({ address: VAULT, network: 'testnet' })
    if (c.resource === 'check_ins') return rows()
    if (c.method === 'GET') return rows()
    if (c.nodeMethod === 'getAccountByAddress') {
      return rpc({ address: VAULT, balance: 100_000, type: 'basic' })
    }
    return rows()
  })

  const res = await POST(await signedReq())
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    alreadyCheckedIn: boolean
    awarded: unknown[]
    unlockedItems: unknown[]
  }
  assert.equal(body.alreadyCheckedIn, true)
  assert.deepEqual(body.awarded, [])
  assert.deepEqual(body.unlockedItems, [])
})
