/**
 * Savborne — Client session
 *
 * Identity is the player's Nimiq address. There is no Supabase Auth session;
 * we simply persist the connected address in `localStorage` (survives reload)
 * alongside a small display-name cache so the home screen can render before
 * the DB round-trip completes.
 *
 * The stored address is only useful when it matches the address Nimiq Pay
 * returns from `listAccounts()` — otherwise a different person could pick up
 * someone else's game state on a shared device. Every read is therefore
 * paired with a verification against the wallet in `usePlayerSession()` below.
 *
 * Server-side: API routes receive the address in a request header
 * (`X-Player-Address`). Handlers should trust-but-verify by confirming the
 * address exists in the `players` table before writing.
 *
 * NOTE: no `'use client'` directive here. This module is imported by BOTH
 * client components (authHeaders/readSession) and server route handlers
 * (PLAYER_HEADER). A 'use client' at the top would turn every export into a
 * client reference and crash server imports with "Attempted to call
 * PLAYER_HEADER() from the server". Browser-only functions guard on
 * `typeof window` internally instead. (ERRORS.md 2026-10-16.)
 */

const STORAGE_KEY = 'savborne.session.v1'

export type Session = {
  /** The player's own Nimiq address — the identity key. */
  playerAddress: string
  /** The dedicated savings account being tracked. */
  savingsAddress: string
  /** Display name shown on the leaderboard. */
  displayName: string
}

/** Read the cached session. Returns null if none or if not in a browser. */
export function readSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session>
    if (!parsed.playerAddress || !parsed.savingsAddress || !parsed.displayName) return null
    return {
      playerAddress: parsed.playerAddress,
      savingsAddress: parsed.savingsAddress,
      displayName: parsed.displayName,
    }
  } catch {
    return null
  }
}

/** Persist a session. Pass `null` to clear. */
export function writeSession(session: Session | null): void {
  if (typeof window === 'undefined') return
  if (session === null) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

/** The header name we use to pass the address to API routes. */
export const PLAYER_HEADER = 'X-Player-Address'

/**
 * Build the headers object for a fetch call to any Savborne API route.
 * Returns `{}` if no session is stored, so the route 401s naturally.
 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const session = readSession()
  if (!session) return extra
  return { [PLAYER_HEADER]: session.playerAddress, ...extra }
}
