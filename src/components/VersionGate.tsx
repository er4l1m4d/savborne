/**
 * Savborne — Version gate
 *
 * Client component that checks on mount whether the running Nimiq Pay build
 * exposes `getBalance`. If not, it renders an "Update Nimiq Pay" prompt
 * instead of children, so the rest of the app never tries to hit APIs that
 * would silently misbehave. If it is available, children render as normal.
 *
 * Also detects when the app is opened in a plain browser (outside Nimiq Pay)
 * and shows a friendly notice rather than an infinite spinner.
 */

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isGetBalanceAvailable, isInsideNimiqPay, WalletError } from '@/lib/nimiq'

/**
 * Paths that must render outside Nimiq Pay: they are opened by link, not by a
 * player inside the wallet. A shared flex card is the whole point of the card
 * route, so gating it on the wallet would make it useless.
 */
const PUBLIC_PREFIXES = ['/card/']

type State =
  | { phase: 'checking' }
  | { phase: 'ready' }
  | { phase: 'outside_nimiq' }
  | { phase: 'update_required'; reason?: string }

export function VersionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ phase: 'checking' })
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (!isInsideNimiqPay()) {
        if (!cancelled) setState({ phase: 'outside_nimiq' })
        return
      }
      try {
        const ok = await isGetBalanceAvailable()
        if (!cancelled) setState(ok ? { phase: 'ready' } : { phase: 'update_required' })
      } catch (err) {
        if (cancelled) return
        const reason =
          err instanceof WalletError ? `Wallet error: ${err.type}` : 'Wallet unavailable'
        setState({ phase: 'update_required', reason })
      }
    }
    // Async call inside effect body — React Compiler's set-state-in-effect
    // rule is a false positive on this pattern; see ERRORS.md 2026-10-15.
    check()
    return () => {
      cancelled = true
    }
  }, [])

  // Public routes render anywhere: they are opened by shared link, outside the
  // wallet, and gating them on Nimiq Pay would defeat their purpose.
  if (PUBLIC_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
    return <>{children}</>
  }

  if (state.phase === 'checking') {
    return (
      <div className="min-h-dvh flex items-center justify-center text-fg-muted text-sm">
        Preparing Savborne…
      </div>
    )
  }

  if (state.phase === 'outside_nimiq') {
    return (
      <GateShell
        title="Open inside Nimiq Pay"
        body="Savborne is a Nimiq Pay Mini App. Open this URL inside the Nimiq Pay app to connect your savings account."
      />
    )
  }

  if (state.phase === 'update_required') {
    return (
      <GateShell
        title="Update Nimiq Pay"
        body={
          state.reason
            ? `Savborne could not reach the wallet: ${state.reason}. Please update Nimiq Pay and try again.`
            : 'Savborne needs a newer version of Nimiq Pay that supports balance reads. Please update Nimiq Pay from your app store, then reopen this Mini App.'
        }
      />
    )
  }

  return <>{children}</>
}

function GateShell({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-(--gut)">
      <div className="vpx bg-surface p-6 max-w-90 w-full flex flex-col gap-3">
        <h1
          className="text-2xl leading-tight"
          style={{ fontFamily: 'var(--font-silkscreen)' }}
        >
          {title}
        </h1>
        <p className="text-sm text-fg-muted leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
