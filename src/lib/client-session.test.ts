/**
 * Client session acquisition.
 *
 * These tests run the real module against a fake browser: a Map-backed
 * localStorage and a provider whose `sign()` only counts calls. `fetch` is
 * replaced per test, matching the rest of the suite's fake-network seam.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiFetch, ensureSessionToken } from './client-session'

const ADDRESS = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const SESSION_KEY = 'savborne.session.v1'
const TOKEN_KEY = 'savborne.auth.v1'

let signCalls = 0
let provider: { sign: (message: string) => Promise<{ publicKey: string; signature: string }> }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function installBrowser(t: { after: (fn: () => void) => void }, options?: { session?: boolean }) {
  const store = new Map<string, string>()
  if (options?.session !== false) {
    store.set(
      SESSION_KEY,
      JSON.stringify({
        playerAddress: ADDRESS,
        savingsAddress: 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL',
        displayName: 'Tester',
      }),
    )
  }

  signCalls = 0
  provider = {
    sign: async () => {
      signCalls++
      return { publicKey: 'ab'.repeat(32), signature: 'cd'.repeat(64) }
    },
  }

  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    },
    nimiq: provider,
  }

  const realFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = realFetch
    delete (globalThis as unknown as { window?: unknown }).window
  })

  return store
}

test('a revoked session is re-signed and the request is retried once', async (t) => {
  const store = installBrowser(t)
  store.set(
    TOKEN_KEY,
    JSON.stringify({ address: ADDRESS, token: 'revoked', expiresAt: Date.now() + 3_600_000 }),
  )

  let vaultCalls = 0
  let sessionCalls = 0

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/session') {
      sessionCalls++
      return json({ token: 'fresh', expiresAt: Date.now() + 3_600_000 })
    }
    if (url === '/api/vaults') {
      vaultCalls++
      if (vaultCalls === 1) return json({ error: 'session_revoked' }, 401)
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('X-Savborne-Session'), 'fresh')
      return json({ vault: null })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as typeof fetch

  const res = await apiFetch('/api/vaults')

  assert.equal(res.status, 200)
  assert.equal(signCalls, 1)
  assert.equal(sessionCalls, 1)
  assert.equal(vaultCalls, 2)
})

test('a non-session 401 is returned untouched, without a re-sign', async (t) => {
  const store = installBrowser(t)
  store.set(
    TOKEN_KEY,
    JSON.stringify({ address: ADDRESS, token: 'live', expiresAt: Date.now() + 3_600_000 }),
  )

  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return json({ error: 'forbidden' }, 401)
  }) as typeof fetch

  const res = await apiFetch('/api/vaults')

  assert.equal(res.status, 401)
  assert.equal(calls, 1)
  assert.equal(signCalls, 0)
})

test('a wrong-signer session error names the account problem', async (t) => {
  installBrowser(t, { session: false })

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    assert.equal(String(input), '/api/session')
    return json({ error: 'wrong_signer' }, 401)
  }) as typeof fetch

  await assert.rejects(ensureSessionToken(ADDRESS), /different account than the one selected/)
})

test('a rate-limited session error is actionable, not a bare status', async (t) => {
  installBrowser(t, { session: false })

  globalThis.fetch = (async () => json({ error: 'rate_limited' }, 429)) as typeof fetch

  await assert.rejects(ensureSessionToken(ADDRESS), /Wait a moment, then try again/)
})
