'use client'

/**
 * Savborne — vault guard
 *
 * Spec §6.6: on open, a player with no vault is sent to the creation flow. The
 * home screen cannot be edited, so the guard lives in the tabs layout.
 *
 * It is deliberately quiet: no session means the home screen owns the
 * redirect; a failed probe means render nothing (never block the app on a
 * network hiccup). It cannot loop, because `/setup/vault` is outside the tabs
 * group and unmounts this component.
 */

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authHeaders, readSession } from '@/lib/session'

export function VaultGuard() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const session = readSession()
    if (!session) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/vaults', { headers: authHeaders() })
        if (!res.ok) return
        const body = (await res.json()) as { vault: unknown }
        if (!cancelled && body.vault === null && pathname !== '/vault') {
          // Go to the vault tab, which offers creation. Routing to /setup/vault
          // directly would strand an existing player mid-onboarding UI.
          router.replace('/vault')
        }
      } catch {
        // Never block the app on a failed probe.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  return null
}
