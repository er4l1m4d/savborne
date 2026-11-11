/**
 * Test-only request builder for authenticated routes.
 *
 * Production requests carry a signed session token. Route tests describe the
 * player with `X-Player-Address`; this helper mints a valid 12-hour token for
 * that address so every existing fixture keeps working, while the dedicated
 * session tests still construct bare requests by hand.
 *
 * It only adds a token when a player header is present, so "missing identity"
 * cases stay missing.
 */

import { PLAYER_HEADER, SESSION_HEADER } from '@/lib/session'
import { issueSessionToken } from '@/lib/session-token'

export const TEST_SESSION_SECRET = 'test-session-secret-with-at-least-32-bytes'

export function authRequest(input: string | URL, init?: RequestInit): Request {
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET
  }
  const headers = new Headers(init?.headers)
  const address = headers.get(PLAYER_HEADER)
  if (address && !headers.has(SESSION_HEADER)) {
    headers.set(SESSION_HEADER, issueSessionToken(address).token)
  }
  return new Request(input, { ...init, headers })
}
