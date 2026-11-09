'use client'

/**
 * Savborne - Nimiq Pay gate
 *
 * The gate is a state machine, not a set of routes: every route sits behind it,
 * so a gate route would either be gated too or need an exemption. The three
 * states are the handoff's Preparing, Open inside Nimiq Pay and Update screens.
 *
 * `/card/*` is the one exception: shared cards are opened by link, outside the
 * wallet, so gating them on Nimiq Pay would defeat their purpose.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isGetBalanceAvailable, isInsideNimiqPay, WalletError } from '@/lib/nimiq'
import { BrandMark } from '@/components/BrandMark'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Glyph } from '@/components/Glyphs'
import { ScreenShell } from '@/components/ui/ScreenShell'

const PUBLIC_PREFIXES = ['/card/']

type State =
  | { phase: 'checking' }
  | { phase: 'ready' }
  | { phase: 'outside_nimiq' }
  | { phase: 'update_required'; reason?: string }

export function VersionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ phase: 'checking' })
  const [attempt, setAttempt] = useState(0)
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

    // Async call inside the effect body. The set-state-in-effect rule is a false
    // positive on this pattern; see ERRORS.md 2026-10-15.
    check()
    return () => {
      cancelled = true
    }
  }, [attempt])

  // Public routes render anywhere: they are opened by shared link, outside the
  // wallet, and gating them on Nimiq Pay would defeat their purpose.
  if (PUBLIC_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
    return <>{children}</>
  }

  if (state.phase === 'checking') {
    return (
      <ScreenShell variant="pushed" bodyClassName="items-center justify-center pt-0">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark />
          <span className="sv-body text-fg-muted">Preparing Savborne…</span>
        </div>
      </ScreenShell>
    )
  }

  if (state.phase === 'outside_nimiq') {
    return (
      <GateScreen
        icon={<Glyph name="phone" size={72} />}
        headline="Savborne lives inside Nimiq Pay"
        body="Savborne is a Nimiq Pay Mini App. Open this URL inside the Nimiq Pay app to create your vault."
      />
    )
  }

  if (state.phase === 'update_required') {
    return (
      <GateScreen
        icon={<Glyph name="update" size={72} className="text-mint" />}
        headline="Update Nimiq Pay to continue"
        body="This version of Nimiq Pay can't share your vault balance with Savborne yet. Update it, then reopen Savborne. Nothing has been recorded."
        reason={state.reason}
        actions={
          <>
            <ButtonLink
              href="https://nimiq.com"
              target="_blank"
              rel="noreferrer"
              variant="primary"
            >
              Update Nimiq Pay
            </ButtonLink>
            <Button
              variant="secondary"
              onClick={() => {
                setState({ phase: 'checking' })
                setAttempt((n) => n + 1)
              }}
            >
              I&apos;ve updated, try again
            </Button>
          </>
        }
      />
    )
  }

  return <>{children}</>
}

function GateScreen({
  icon,
  headline,
  body,
  reason,
  actions,
}: {
  icon: ReactNode
  headline: string
  body: string
  reason?: string
  actions?: ReactNode
}) {
  return (
    <ScreenShell variant="pushed" bodyClassName="gap-5 pt-0">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <PixelPanel className="w-[132px] h-[132px] flex items-center justify-center">
          {icon}
        </PixelPanel>
        <div className="flex flex-col gap-2">
          <h1 className="sv-subheading-lg">{headline}</h1>
          <p className="sv-body text-fg-muted">{body}</p>
          {reason && <p className="sv-label text-fg-faint">{reason}</p>}
        </div>
      </div>

      {actions && <div className="flex flex-col gap-3.5">{actions}</div>}
    </ScreenShell>
  )
}
