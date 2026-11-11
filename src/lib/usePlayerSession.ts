/**
 * Savborne — Player session hook
 *
 * Reads the cached session from localStorage, verifies that the stored
 * player address still matches an account returned by `listAccounts()`
 * (protects against a shared-device takeover), and fetches the current
 * player state from `/api/players/me`.
 *
 * Exposes a `refresh()` the home screen calls after any state-changing
 * mutation (check-in, mission completion) so the UI stays in sync with
 * the server.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { readSession, writeSession, authHeaders, type Session } from '@/lib/session'
import { listAccounts, WalletError } from '@/lib/nimiq'
import { playLevelUp } from '@/lib/level-up-sound'
import { buzz } from '@/lib/haptics'
import { observeLevel } from '@/lib/level-up'
import type { Avatar } from '@/lib/avatar'
import { apiFetch } from '@/lib/client-session'

export type PlayerMe = {
  address: string
  displayName: string
  avatar: Avatar
  savingsAddress: string
  level: number
  xp: number
  xpToNext: number
  bracket: string | null
  balanceLuna: number
  streakCurrent: number
  streakBest: number
  shields: number
  shieldsEarned: number
  hasVault: boolean
  checkInCount: number
  rating: number
  wins: number
  losses: number
  ties: number
  lastCheckInAt: string | null
  dailyXpEarnedToday: number
  weeklyXpEarnedThisWeek: number
  battlesToday: number
}

export type UsePlayerSessionResult = {
  /** Session as stored in localStorage, or null if the user hasn't completed onboarding. */
  session: Session | null
  /** Player state from the server, or null while loading or if the wallet doesn't match. */
  player: PlayerMe | null
  /** True while verifying the session and fetching player state. */
  loading: boolean
  /** Set if the stored address no longer matches the wallet — user must re-onboard. */
  needsReconnect: boolean
  /** Set if the check-in state failed to load with a non-401 error. */
  error: string | null
  /** Refetch player state; call after any mutation. */
  refresh: () => Promise<void>
  /** Clear the session and reset local state (used by "Disconnect" actions). */
  signOut: () => void
}

export function usePlayerSession(): UsePlayerSessionResult {
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<PlayerMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // Defer to a microtask so this function's synchronous setState calls do
    // not run in the same tick as the useEffect that invokes it. React's
    // compiler treats that pattern as a cascading render and warns.
    await Promise.resolve()
    const current = readSession()
    if (!current) {
      setSession(null)
      setPlayer(null)
      setNeedsReconnect(false)
      setError(null)
      setLoading(false)
      return
    }

    try {
      // Verify the wallet still owns this address.
      const accounts = await listAccounts()
      if (!accounts.includes(current.playerAddress)) {
        setNeedsReconnect(true)
        setSession(null)
        setPlayer(null)
        writeSession(null)
        setLoading(false)
        return
      }
    } catch (err) {
      // Wallet failure — likely PERMISSION_DENIED or provider unavailable.
      if (err instanceof WalletError && err.type === 'PERMISSION_DENIED') {
        setNeedsReconnect(true)
      } else {
        setError(err instanceof Error ? err.message : 'Wallet unavailable')
      }
      setLoading(false)
      return
    }

    setSession(current)

    try {
      const res = await apiFetch('/api/players/me', { headers: authHeaders() })
      if (!res.ok) {
        if (res.status === 404) {
          // Player row was wiped server-side; treat as needs-reconnect.
          setNeedsReconnect(true)
          setSession(null)
          writeSession(null)
        } else if (res.status === 401) {
          // apiFetch already tried one silent re-sign. A second 401 means the
          // wallet refused or the account changed; /setup is the inline
          // reconnect path, not a dead end.
          let code = ''
          try {
            code = ((await res.json()) as { error?: string }).error ?? ''
          } catch {
            // Non-JSON 401: treat as reconnect.
          }
          if (code.startsWith('session_')) {
            setNeedsReconnect(true)
            setError(null)
          } else {
            setError('Could not verify this wallet. Reconnect to continue.')
          }
        } else {
          const text = await res.text().catch(() => '')
          setError(`Failed to load player (${res.status}): ${text}`)
        }
      } else {
        const json = (await res.json()) as { player: PlayerMe }
        detectLevelUp(json.player)
        setPlayer(json.player)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signOut = useCallback(() => {
    writeSession(null)
    setSession(null)
    setPlayer(null)
    setNeedsReconnect(false)
    setLoading(false)
  }, [])

  return { session, player, loading, needsReconnect, error, refresh, signOut }
}

/**
 * Fire the level-up effect exactly once per level, across every mounted hook.
 * `observeLevel` holds the shared memory and stays silent on first sight.
 */
function detectLevelUp(player: PlayerMe): void {
  if (observeLevel(player.address, player.level)) {
    playLevelUp()
    buzz([30, 40, 30])
  }
}
