'use client'

/**
 * Savborne — guided vault tour
 *
 * Five steps, custom overlay, no library. It starts on `/vault` and points at
 * real anchors: the balance card, the shield strip, the deposit button, and —
 * for the two steps about checking in — the Home tab icon, because Home itself
 * is off-limits to this build and pretending to spotlight its button would be a
 * lie.
 *
 * A missing anchor centres the card instead of crashing: the tour must never be
 * the reason a screen breaks. It is skippable at every step and never traps
 * focus, so a keyboard user can always leave.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button } from '@/components/ui/Button'

export const TOUR_FLAG_KEY = 'savborne.tour.v1'

type Step = {
  /** Selector for the element to spotlight, or null to centre the card. */
  anchor: string | null
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    anchor: '[data-tour="vault"]',
    title: 'Your vault',
    body: 'This is your vault. The NIM in it is yours alone — Savborne never holds it and cannot move it.',
  },
  {
    anchor: '[data-tour="shields"]',
    title: 'Streak & shields',
    body: 'Miss a day and a shield covers you, so one bad day does not end your streak.',
  },
  {
    anchor: '[data-tour="home"]',
    title: 'Check in daily',
    body: 'Check in here every day to keep the streak — tap Home when you are ready.',
  },
  {
    anchor: '[data-tour="home"]',
    title: 'XP, level & bracket',
    body: 'XP, level and bracket all grow from checking in. The longer the streak, the faster they climb.',
  },
  {
    anchor: '[data-tour="deposit"]',
    title: 'Start saving',
    body: 'Start here. Your first deposit opens the vault and puts you on the board.',
  },
]

export function isTourPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(TOUR_FLAG_KEY) !== 'done'
  } catch {
    return false
  }
}

export function VaultTour() {
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Only ever shown on the vault screen, and only once. Arriving elsewhere with
  // the flag unset does not launch the tour. Deferred to a microtask so the
  // synchronous setState is not treated as a cascading render (same pattern as
  // usePlayerSession's refresh).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.resolve()
      if (!cancelled && pathname === '/vault' && isTourPending()) setActive(true)
    })()
    return () => {
      cancelled = true
    }
  }, [pathname])

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(TOUR_FLAG_KEY, 'done')
    } catch {
      // Non-fatal: the tour may reappear, which is the safe failure.
    }
    setActive(false)
  }, [])

  const step = STEPS[index]

  // Measure the current anchor. Runs on every step and on resize/scroll so the
  // ring tracks the target rather than drifting.
  useLayoutEffect(() => {
    if (!active) return
    const measure = () => {
      const el = step.anchor ? document.querySelector(step.anchor) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, step.anchor, index])

  // Escape leaves the tour. Focus the card when the tour opens so a keyboard
  // user is not stranded behind the overlay.
  useEffect(() => {
    if (!active) return
    cardRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish])

  if (!active) return null

  const last = index === STEPS.length - 1
  const pad = 8

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Vault tour"
      className="fixed inset-0 z-50"
    >
      {/* Dimmer. A click outside also dismisses — never a dead end. */}
      <button
        aria-label="Dismiss tour"
        onClick={finish}
        className="absolute inset-0 w-full h-full bg-black/55"
      />

      {rect && (
        <div
          aria-hidden
          className="absolute border-2 border-butter pointer-events-none"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute w-[calc(100%-2rem)] max-w-90 outline-none"
        style={cardPosition(rect)}
      >
        <PixelPanel className="p-4 flex flex-col gap-3">
          <span className="sv-section-label text-fg-faint">
            Step {index + 1} of {STEPS.length}
          </span>
          <h2 className="sv-subheading">{step.title}</h2>
          <p className="sv-body text-fg-muted">{step.body}</p>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                variant="secondary"
                size="sm"
                fullWidth={false}
                onClick={() => setIndex((i) => i - 1)}
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              fullWidth={false}
              className="flex-1"
              onClick={() => (last ? finish() : setIndex((i) => i + 1))}
            >
              {last ? 'Deposit now' : 'Next'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                finish()
                router.push('/vault')
              }}
            >
              Skip
            </Button>
          </div>
        </PixelPanel>
      </div>
    </div>
  )
}

/** Place the card under the anchor when there is room, else centred. */
function cardPosition(rect: DOMRect | null): React.CSSProperties {
  if (!rect || typeof window === 'undefined') {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const below = rect.bottom + 16
  const fitsBelow = below + 220 < window.innerHeight
  const centerX = Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170)
  return {
    top: fitsBelow ? below : Math.max(16, rect.top - 236),
    left: centerX,
    transform: 'translateX(-50%)',
  }
}
