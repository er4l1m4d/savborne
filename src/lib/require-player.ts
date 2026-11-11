/**
 * Savborne - the one server-side identity guard.
 *
 * Every route that reads or changes a player's state calls this. The session
 * token is the authority; `X-Player-Address` is only a convenience/echo and
 * must agree with it when present.
 *
 *   { address }          -> authenticated, use the address
 *   NextResponse (401)   -> stable session code, no database or chain read
 *
 * A missing secret is a server misconfiguration: 503 `session_unavailable`,
 * never a bypass.
 */

import { NextResponse } from 'next/server'
import { PLAYER_HEADER, SESSION_HEADER } from './session'
import { verifySessionToken } from './session-token'
import { sameAddress } from './vault/address'

export type PlayerAuth = { address: string } | NextResponse

export function requirePlayer(req: Request): PlayerAuth {
  const token = req.headers.get(SESSION_HEADER)
  if (!token) {
    return NextResponse.json({ error: 'session_required' }, { status: 401 })
  }

  let result
  try {
    result = verifySessionToken(token)
  } catch {
    // Missing/short SESSION_SECRET. Do not fail open.
    return NextResponse.json({ error: 'session_unavailable' }, { status: 503 })
  }

  if (!result.ok) {
    const error = result.reason === 'expired' ? 'session_expired' : 'session_invalid'
    return NextResponse.json({ error }, { status: 401 })
  }

  const claimed = req.headers.get(PLAYER_HEADER)
  if (claimed && !sameAddress(claimed, result.address)) {
    return NextResponse.json({ error: 'session_mismatch' }, { status: 401 })
  }

  return { address: result.address }
}

/** True when `requirePlayer` returned a response instead of an identity. */
export function isAuthResponse(value: PlayerAuth): value is NextResponse {
  return value instanceof NextResponse
}
