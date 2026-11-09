'use client'

/**
 * Savborne - First check-in
 *
 * The first successful check-in is a one-time celebration: First Steps, the
 * recorded balance and the bracket items. The check-in hands the summary over;
 * a direct visit goes Home rather than inventing a celebration.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRACKETS, LUNA_PER_NIM } from '@/lib/constants'
import { ITEMS } from '@/lib/game/items'
import { takeFirstCheckInHandoff, type FirstCheckInHandoff } from '@/lib/checkin-handoff'
import { BadgeArt } from '@/components/Glyphs'
import { ItemArt } from '@/components/ItemArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { ButtonLink } from '@/components/ui/Button'

export default function FirstCheckInPage() {
  const router = useRouter()
  const [state, setState] = useState<FirstCheckInHandoff | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const handoff = takeFirstCheckInHandoff()
    if (!handoff) {
      router.replace('/')
      return
    }
    setState(handoff)
  }, [router])

  const bracket = state?.bracket ? BRACKETS[state.bracket] : null
  const items = (state?.items ?? [])
    .map((key) => ITEMS.find((item) => item.key === key))
    .filter((item): item is (typeof ITEMS)[number] => Boolean(item))

  return (
    <ScreenShell variant="pushed">
      {!state ? (
        <p className="sv-body text-fg-muted">Loading…</p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3.5 text-center">
            <PixelPanel className="w-28 h-28 flex items-center justify-center" wrapperClassName="shrink-0">
              <BadgeArt badge="first_steps" state="earned" size={72} />
            </PixelPanel>
            <h1 className="sv-number-xl">First Steps</h1>
            <p className="sv-body text-fg-muted">
              Your savings account is connected and your first check-in is recorded.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PixelPanel className="p-3 flex flex-col gap-1">
              <span className="sv-number-m text-mint">+{state.xp} XP</span>
              <span className="sv-label text-fg-muted">First Steps mission</span>
            </PixelPanel>
            <PixelPanel className="p-3 flex flex-col gap-1">
              <span className="sv-number-m">
                {(state.balanceLuna / LUNA_PER_NIM).toFixed(2)}{' '}
                <span className="sv-label text-fg-muted">NIM</span>
              </span>
              <span className="sv-label text-fg-muted">Balance recorded</span>
            </PixelPanel>
          </div>

          <PixelPanel className="p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="sv-subheading">
                {bracket ? `${bracket.label} bracket unlocked` : 'Entry items unlock at 1 NIM'}
              </h2>
              <span className="sv-label text-fg-muted">
                {bracket ? `${bracket.thresholdNim} NIM` : '1 NIM'}
              </span>
            </div>
            {items.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2.5 bg-sprite-well border-2 border-line p-2.5"
                  >
                    <ItemArt item={item.key} size={32} />
                    <span className="sv-label font-bold leading-tight">{item.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sv-label text-fg-muted">Keep saving to unlock the Entry items.</p>
            )}
          </PixelPanel>

          <ButtonLink href="/" variant="primary">
            Go to Home
          </ButtonLink>
        </>
      )}
    </ScreenShell>
  )
}
