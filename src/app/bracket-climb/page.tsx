'use client'

/**
 * Savborne - Bracket Climb
 *
 * A celebration shown once after a check-in lifts the player into a new
 * bracket. The check-in hands off the bracket, any Bracket Climb XP and the
 * items that unlocked; a direct visit falls back to the current profile
 * bracket so the route is never a dead end.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders, readSession } from '@/lib/session'
import { BRACKETS, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { takeBracketHandoff, type BracketHandoff } from '@/lib/checkin-handoff'
import { ItemArt } from '@/components/ItemArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

type State = BracketHandoff

export default function BracketClimbPage() {
  const router = useRouter()
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handoff = takeBracketHandoff()
    if (handoff) {
      setState(handoff)
      return
    }

    if (!readSession()) {
      router.replace('/setup')
      return
    }

    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/profile', { headers: authHeaders() })
      if (res.status === 401) {
        router.replace('/setup')
        return
      }
      if (!res.ok) throw new Error(`Could not load your bracket (${res.status}).`)
      const json = (await res.json()) as { player: { bracket: Bracket | null } }
      if (!json.player.bracket) {
        router.replace('/')
        return
      }
      if (!cancelled) {
        setState({ bracket: json.player.bracket, xp: 0, items: [] })
      }
    })().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Could not load your bracket.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [router])

  const bracket = state ? BRACKETS[state.bracket] : null
  const unlocked = (state?.items ?? [])
    .map((key) => ITEMS.find((item) => item.key === key))
    .filter((item): item is (typeof ITEMS)[number] => Boolean(item))

  return (
    <ScreenShell variant="pushed">
      {error ? (
        <Banner tone="error">{error}</Banner>
      ) : !state || !bracket ? (
        <p className="sv-body text-fg-muted">Loading your bracket…</p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3.5 text-center">
            <PixelPanel
              className="w-28 h-28 flex items-center justify-center"
              wrapperClassName="shrink-0"
            >
              <span className="sv-number-m" style={{ color: bracket.color }}>
                {bracket.label}
              </span>
            </PixelPanel>
            <h1 className="sv-number-xl">Bracket Climb</h1>
            <p className="sv-body text-fg-muted">
              You&apos;ve reached the {bracket.label} bracket at {bracket.thresholdNim}
              {'\u00a0'}NIM.
              {unlocked.length === 2
                ? ' Two new items are yours.'
                : unlocked.length === 1
                  ? ' One new item is yours.'
                  : ' Keep saving to unlock the next tier.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {state.xp > 0 && (
              <PixelPanel className="p-3 flex flex-col gap-1">
                <span className="sv-number-m text-mint">+{state.xp} XP</span>
                <span className="sv-label text-fg-muted">Bracket Climb mission</span>
              </PixelPanel>
            )}
            <PixelPanel className="p-3 flex flex-col gap-1">
              <span className="sv-number-m" style={{ color: bracket.color }}>
                {bracket.label}
              </span>
              <span className="sv-label text-fg-muted">New bracket</span>
            </PixelPanel>
          </div>

          {unlocked.length > 0 && (
            <PixelPanel className="p-4 flex flex-col gap-3">
              <h2 className="sv-subheading">Unlocked items</h2>
              {unlocked.map((item) => (
                <div key={item.key} className="flex items-center gap-3.5">
                  <ItemArt item={item.key} size={48} />
                  <div className="flex flex-col gap-0.5">
                    <span className="sv-label font-bold">{item.name}</span>
                    <span className="sv-label text-fg-muted">{item.blurb}</span>
                  </div>
                </div>
              ))}
            </PixelPanel>
          )}

          <ButtonLink href="/items" variant="primary">
            See my items
          </ButtonLink>
        </>
      )}
    </ScreenShell>
  )
}
