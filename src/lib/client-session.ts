/**
 * Savborne - client session acquisition and API fetch.
 *
 * The wallet signs once per 12 hours. The token is cached in localStorage with
 * its expiry; `apiFetch` attaches it to every Savborne API call. When the
 * server answers 401 with a session code, the cache is cleared, one silent
 * re-sign is attempted, and the request is retried exactly once. A second 401
 * is returned to the caller so the UI can show an inline reconnect.
 *
 * `authHeaders()` (session.ts) stays synchronous for callers that already have
 * a fresh token; this module owns the asynchronous obtain/refresh path.
 */

import {
  readSession,
  readSessionToken,
  writeSessionToken,
  clearSessionToken,
  PLAYER_HEADER,
  SESSION_HEADER,
  type CachedSessionToken,
} from './session'
import { sessionMessage } from './session-request'
import { signMessage } from './nimiq'

type InFlight = { address: string; promise: Promise<CachedSessionToken> }
let inFlight: InFlight | null = null

/** True only for the stable codes `requirePlayer` returns. */
function isSessionCode(value: unknown): boolean {
  return (
    value === 'session_required' ||
    value === 'session_expired' ||
    value === 'session_invalid' ||
    value === 'session_revoked' ||
    value === 'session_mismatch'
  )
}

/** Turn a session-issue error code into something the player can act on. */
function sessionErrorMessage(code: string): string {
  switch (code) {
    case 'stale':
      return 'The wallet signature took too long. Try again.'
    case 'bad_signature':
      return 'Nimiq Pay did not sign this session. Tap again and approve the prompt.'
    case 'wrong_signer':
      return "Nimiq Pay signed with a different account than the one selected. Use the wallet's main account, or switch accounts in Nimiq Pay and try again."
    case 'rate_limited':
      return 'Too many session requests. Wait a moment, then try again.'
    default:
      return `Could not start a session (${code}). Try again.`
  }
}

async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

/**
 * Return a fresh token for `address` (or the stored session's address).
 * Concurrent callers share one wallet prompt. Returns null outside a browser
 * or when there is no address to sign for.
 */
export async function ensureSessionToken(
  address?: string,
): Promise<CachedSessionToken | null> {
  if (typeof window === 'undefined') return null

  const target = address ?? readSession()?.playerAddress
  if (!target) return null

  const cached = readSessionToken()
  if (cached && cached.address === target) return cached

  if (inFlight && inFlight.address === target) return inFlight.promise

  const promise = (async () => {
    const signedAt = Date.now()
    const proof = await signMessage(sessionMessage({ address: target, signedAt }))

    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: target, signedAt, ...proof }),
    })

    if (!res.ok) {
      const code = (await readErrorCode(res)) ?? `http_${res.status}`
      throw new Error(sessionErrorMessage(code))
    }

    const body = (await res.json()) as { token?: unknown; expiresAt?: unknown }
    if (typeof body.token !== 'string' || typeof body.expiresAt !== 'number') {
      throw new Error('Could not start a session. Try again.')
    }

    const value: CachedSessionToken = {
      address: target,
      token: body.token,
      expiresAt: body.expiresAt,
    }
    writeSessionToken(value)
    return value
  })()

  inFlight = { address: target, promise }
  try {
    return await promise
  } finally {
    if (inFlight?.promise === promise) inFlight = null
  }
}

function headersToObject(headers?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  new Headers(headers).forEach((value, key) => {
    out[key] = value
  })
  return out
}

/** Build headers for one attempt: caller headers, token, then the address echo. */
function buildHeaders(target: string | undefined, headers?: HeadersInit): Record<string, string> {
  const out = headersToObject(headers)
  const cached = readSessionToken()
  if (target && cached && cached.address === target) {
    out[SESSION_HEADER] = cached.token
  }
  if (target) out[PLAYER_HEADER] = target
  return out
}

export type ApiFetchOptions = {
  /** Sign for this wallet even before a Session has been written (onboarding). */
  address?: string
}

/**
 * `fetch` for Savborne API routes with one silent session recovery.
 * Non-401 responses and non-session 401s are returned untouched.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const target = options.address ?? readSession()?.playerAddress

  if (target) {
    try {
      await ensureSessionToken(target)
    } catch {
      // The request still goes out; the server answers 401 and the UI shows
      // the wallet error rather than this function inventing a network error.
    }
  }

  const send = () => fetch(input, { ...init, headers: buildHeaders(target, init?.headers) })
  let res = await send()

  if (res.status !== 401) return res

  const code = await readErrorCode(res)
  if (!isSessionCode(code) || !target) return res

  clearSessionToken()
  try {
    await ensureSessionToken(target)
  } catch {
    return res
  }

  res = await send()
  return res
}


/**
 * Fire-and-forget revocation for a real sign-out. Revokes every session for
 * the wallet, so a token copied from another device dies too. The request is
 * sent before the caller clears local storage; `keepalive` lets it finish.
 */
export function revokeSessionOnSignOut(): void {
  if (typeof window === 'undefined') return
  const cached = readSessionToken()
  if (!cached) return
  void fetch('/api/session?all=1', {
    method: 'DELETE',
    headers: {
      [PLAYER_HEADER]: cached.address,
      [SESSION_HEADER]: cached.token,
    },
    keepalive: true,
  }).catch(() => {
    // Best effort: local sign-out must never block on the network.
  })
}
