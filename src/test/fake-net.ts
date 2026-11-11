/**
 * Savborne — test-only fake network
 *
 * API routes reach the outside world through `globalThis.fetch`: supabase-js
 * uses it, and so does the Nimiq RPC client. Installing a fake `fetch` is
 * therefore the one honest seam that lets the REAL route handlers run against a
 * controlled server — no module mocking, no dependency injection, no changes to
 * production code.
 *
 * Design rules that keep tests honest:
 *   • an unmatched call THROWS, so a test can never silently hit the real
 *     internet (or a real Supabase) and pass by accident;
 *   • it records every call, so "GET /api/transfers does not touch the chain"
 *     is asserted on observed traffic, not on a comment.
 */

export type FakeCall = {
  host: string
  /** HTTP method. */
  method: string
  path: string
  /** Table name for a Supabase call, else null. */
  resource: string | null
  /** RPC function name for a Supabase `rpc()` call, else null. */
  rpc: string | null
  /** RPC method name for a Nimiq node call (request body `method`), else null. */
  nodeMethod: string | null
  query: URLSearchParams
  body: unknown
  /** True when the caller used `.single()` (asks for a bare object). */
  wantsSingleObject: boolean
}

export type FakeReply = {
  status?: number
  json?: unknown
}

export type FakeHandler = (call: FakeCall) => FakeReply | undefined

export type FakeNet = {
  calls: FakeCall[]
  /** Calls against a given Supabase table, in order. */
  to(table: string): FakeCall[]
  /** Calls against the Nimiq node with a given JSON-RPC method. */
  node(method: string): FakeCall[]
  restore(): void
}

const SUPABASE_HOST = 'fake.supabase.test'

/** Point both clients at the fake hosts. Env is read lazily, so this is enough. */
export function installFakeNet(handler: FakeHandler): FakeNet {
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://${SUPABASE_HOST}`
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

  const real = globalThis.fetch
  const calls: FakeCall[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input.toString()
    const url = new URL(raw)
    const method = init?.method ?? 'GET'
    const bodyText = typeof init?.body === 'string' ? init.body : ''

    let body: unknown = null
    if (bodyText) {
      try {
        body = JSON.parse(bodyText)
      } catch {
        body = bodyText
      }
    }

    const resource = url.pathname.startsWith('/rest/v1/rpc/')
      ? null
      : (url.pathname.match(/^\/rest\/v1\/([^/]+)/)?.[1] ?? null)
    const rpc = url.pathname.startsWith('/rest/v1/rpc/')
      ? url.pathname.slice('/rest/v1/rpc/'.length)
      : null
    // A Nimiq node call is any non-Supabase host carrying a JSON-RPC `method`.
    const nodeMethod =
      url.hostname !== SUPABASE_HOST && body && typeof body === 'object'
        ? String((body as { method?: unknown }).method ?? '') || null
        : null

    const call: FakeCall = {
      host: url.hostname,
      method,
      path: url.pathname,
      resource,
      rpc,
      nodeMethod,
      query: url.searchParams,
      body,
      wantsSingleObject:
        new Headers(init?.headers ?? {}).get('accept') === 'application/vnd.pgrst.object+json',
    }
    // Session liveness is checked on every authenticated request, including
    // the "reject before any query" tests. Treat it as infrastructure: allow a
    // handler to override the answer (revocation tests) but never record it as
    // a business query and never let a strict handler's throw break it.
    let reply
    if (call.rpc === 'session_is_active') {
      let override
      try {
        override = handler(call)
      } catch {
        override = undefined
      }
      // A catch-all handler often returns `rows()` for unknown calls. Only an
      // explicit boolean is a real override; everything else means "active".
      reply =
        override && typeof override.json === 'boolean' ? override : { json: true }
    } else {
      calls.push(call)
      reply =
        handler(call) ??
        // Rate limiting is infrastructure too: tests that care about 429
        // provide an explicit reply; everything else stays strict.
        (call.rpc === 'consume_rate_limit'
          ? { json: { allowed: true, remaining: 1, retryAfterSeconds: 0 } }
          : undefined)
    }
    if (reply === undefined) {
      throw new Error(
        `Unmatched fake-network call: ${method} ${url.hostname}${url.pathname}` +
          `${url.search ? `?${url.search}` : ''}` +
          (rpc ? ` (rpc:${rpc})` : '') +
          (nodeMethod ? ` (node:${nodeMethod})` : ''),
      )
    }

    // PostgREST serialises a `.single()` result as a BARE OBJECT, not an array.
    // A handler that returns `rows(x)` should therefore be normalised here, so
    // tests can always describe results as row arrays.
    let payload = reply.json
    if (
      call.wantsSingleObject &&
      Array.isArray(payload) &&
      payload.length === 1 &&
      !reply.status
    ) {
      payload = payload[0]
    }

    const bodyOut = payload === undefined ? 'null' : JSON.stringify(payload)
    return new Response(bodyOut, {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  return {
    calls,
    to: (table) => calls.filter((c) => c.resource === table),
    node: (m) => calls.filter((c) => c.nodeMethod === m),
    restore: () => {
      globalThis.fetch = real
    },
  }
}

/** A Nimiq node transaction as `getTransactionByHash` returns it. */
export function nodeTx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    hash: 'ab'.repeat(32),
    blockNumber: 15_709_650,
    from: 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000',
    to: 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL',
    value: 100_000,
    fee: 0,
    networkId: 5,
    executionResult: true,
    confirmations: 1,
    ...overrides,
  }
}

/** A minimal Supabase row-array reply. */
export function rows(...data: unknown[]): FakeReply {
  return { json: data }
}
