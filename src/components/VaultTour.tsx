'use client'

/**
 * Savborne — guided tours
 *
 * One anchor-based engine, two tours:
 *   • the app tour opens on Home and walks the loop: savings, check-in,
 *     Missions, Battle, Ranks, Profile and the vault;
 *   • the vault tour opens on `/vault` and covers the balance card, shields,
 *     the Home tab, XP/brackets and the deposit control.
 *
 * The engine is deliberately small and library-free. It points at real
 * anchors, never traps focus, is skippable at every step, and centres the card
 * when an anchor is missing — a tour must never be the reason a screen breaks.
 * Anchors appear after the screen's data loads, so a MutationObserver keeps the
 * ring on the target instead of measuring once against a skeleton.
 *
 * Each tour has its own flag, so a player who lands on the vault first still
 * gets the detailed vault walkthrough. Finishing the app tour also marks the
 * vault tour done: a Home-first player already saw where the vault is and
 * should not hit a second modal walkthrough the moment they open it.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { usePathname } from 'next/navigation'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button } from '@/components/ui/Button'

/** Legacy vault tour flag. Kept for storage already written by shipped builds. */
export const TOUR_FLAG_KEY = 'savborne.tour.v1'
export const APP_TOUR_FLAG_KEY = 'savborne.tour.app.v1'

type Step = {
  /** Selector for the element to spotlight, or null to centre the card. */
  anchor: string | null
  title: string
  body: string
}

export type TourKind = 'app' | 'vault'

const APP_STEPS: Step[] = [
  {
    anchor: '[data-tour="home-savings"]',
    title: 'Your savings',
    body: 'Your vault balance is read from the Nimiq chain, not from a number the app stores. Only you can move it.',
  },
  {
    anchor: '[data-tour="checkin"]',
    title: 'Check in daily',
    body: 'One check-in per UTC day records your real balance and awards XP, streak progress and missions. A shield covers one missed day.',
  },
  {
    anchor: '[data-tour="nav-missions"]',
    title: 'Missions',
    body: 'Daily and weekly missions pay XP. The one-time Milestones tab teaches the rest of the loop.',
  },
  {
    anchor: '[data-tour="nav-battle"]',
    title: 'Battle',
    body: 'Duel the AI, challenge a friend, or unlock ranked at level 3 with five check-ins.',
  },
  {
    anchor: '[data-tour="nav-ranks"]',
    title: 'Ranks',
    body: 'Ranked and savings boards. Display names only — balances stay private.',
  },
  {
    anchor: '[data-tour="nav-profile"]',
    title: 'Profile',
    body: 'Your character, badges, check-in record and settings. Replay this tour any time from Settings.',
  },
  {
    anchor: '[data-tour="vault-link"]',
    title: 'Your vault',
    body: 'Open the vault to deposit or withdraw. Savborne never holds or moves your NIM.',
  },
]

const VAULT_STEPS: Step[] = [
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
    anchor: '[data-tour="nav-home"]',
    title: 'Check in daily',
    body: 'Check in here every day to keep the streak — tap Home when you are ready.',
  },
  {
    anchor: '[data-tour="nav-home"]',
    title: 'XP, level & bracket',
    body: 'XP, level and bracket all grow from checking in. The longer the streak, the faster they climb.',
  },
  {
    anchor: '[data-tour="deposit"]',
    title: 'Start saving',
    body: 'Start here. Your first deposit opens the vault and puts you on the board.',
  },
]

const TOURS: Record<TourKind, { steps: Step[]; flag: string; lastLabel: string }> = {
  app: { steps: APP_STEPS, flag: APP_TOUR_FLAG_KEY, lastLabel: 'Start playing' },
  vault: { steps: VAULT_STEPS, flag: TOUR_FLAG_KEY, lastLabel: 'Deposit now' },
}

function tourKindFor(pathname: string | null): TourKind | null {
  if (pathname === '/') return 'app'
  if (pathname === '/vault') return 'vault'
  return null
}

export function isTourPending(kind: TourKind = 'vault'): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(TOURS[kind].flag) !== 'done'
  } catch {
    return false
  }
}

export function VaultTour() {
  const pathname = usePathname()
  const kind = tourKindFor(pathname)
  const tour = kind ? TOURS[kind] : null
  const steps = tour?.steps ?? []

  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const step = steps[index]

  // Leaving the screen ends the tour; the next screen can start its own.
  useEffect(() => {
    setActive(false)
    setIndex(0)
    setRect(null)
  }, [pathname])

  // Start only once the first anchor exists, so the card does not open over a
  // loading skeleton and then jump. The 2s fallback means a missing anchor can
  // never hide the tour forever.
  useEffect(() => {
    if (!kind || !tour || !isTourPending(kind)) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    const waitForAnchor = () => {
      if (cancelled) return
      const anchor = tour.steps[0]?.anchor
      const ready = !anchor || document.querySelector(anchor) !== null
      if (ready || Date.now() - startedAt > 2000) {
        setIndex(0)
        setActive(true)
        return
      }
      timer = setTimeout(waitForAnchor, 100)
    }

    waitForAnchor()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [kind, pathname, tour])

  const finish = useCallback(() => {
    if (!kind) return
    try {
      window.localStorage.setItem(TOURS[kind].flag, 'done')
      // The app tour already points at the vault. Do not follow it with the
      // five-step vault tour on the player's first visit. The vault tour still
      // runs for deep links that reach /vault before Home.
      if (kind === 'app') window.localStorage.setItem(TOUR_FLAG_KEY, 'done')
    } catch {
      // Non-fatal: the tour may reappear, which is the safe failure.
    }
    setActive(false)
  }, [kind])

  // Measure the current anchor, and keep measuring when async content lands.
  useLayoutEffect(() => {
    if (!active) return
    let frame = 0

    const measure = () => {
      frame = 0
      const el = step?.anchor ? document.querySelector(step.anchor) : null
      const next = el ? el.getBoundingClientRect() : null
      setRect((previous) => (sameRect(previous, next) ? previous : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [active, step?.anchor, index])

  // Escape leaves the tour. Focus the card when it opens so a keyboard user is
  // not stranded behind the overlay.
  useEffect(() => {
    if (!active) return
    cardRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish])

  if (!active || !tour || !step) return null

  const last = index === steps.length - 1
  const pad = 8

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={kind === 'app' ? 'Savborne tour' : 'Vault tour'}
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
        className="absolute w-[calc(100%-2rem)] max-w-90 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain outline-none"
        style={cardPosition(rect)}
      >
        <PixelPanel className="p-4 flex flex-col gap-3">
          <span className="sv-section-label text-fg-faint">
            Step {index + 1} of {steps.length}
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
              {last ? tour.lastLabel : 'Next'}
            </Button>
            {!last && (
              <Button variant="ghost" onClick={finish}>
                Skip
              </Button>
            )}
          </div>
        </PixelPanel>
      </div>
    </div>
  )
}

function sameRect(previous: DOMRect | null, next: DOMRect | null): boolean {
  if (!previous || !next) return previous === next
  return (
    previous.top === next.top &&
    previous.left === next.left &&
    previous.width === next.width &&
    previous.height === next.height
  )
}

/** Place the card under the anchor when there is room, else above/centred. */
function cardPosition(rect: DOMRect | null): CSSProperties {
  if (!rect || typeof window === 'undefined') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxHeight: 'calc(100dvh - 2rem)',
    }
  }

  const half = Math.min(180, (window.innerWidth - 32) / 2)
  // On a desktop the app frame is narrower than the viewport; keep the card
  // inside the phone column instead of letting it float into the dark gutter.
  const frame = document.querySelector('.sv-frame')?.getBoundingClientRect()
  const minX = frame ? frame.left + half + 8 : half
  const maxX = frame ? frame.right - half - 8 : window.innerWidth - half
  const centerX = Math.min(Math.max(rect.left + rect.width / 2, minX), maxX)

  const spaceBelow = window.innerHeight - rect.bottom - 16
  const spaceAbove = rect.top - 16
  // Prefer below when it can show a readable card; otherwise take the larger
  // side. The card scrolls when the viewport is short, so the ring stays on
  // screen instead of the card overlapping its own target.
  const placeBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
  const top = placeBelow
    ? Math.min(rect.bottom + 16, Math.max(16, window.innerHeight - 340))
    : Math.max(16, rect.top - 16 - 340)

  return {
    top,
    left: centerX,
    transform: 'translateX(-50%)',
    maxHeight: `calc(100dvh - ${top}px - 16px)`,
  }
}
