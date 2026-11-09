'use client'

/**
 * Savborne - Balance dropped
 *
 * Shown when a check-in reads less than the previous one. The tone is neutral:
 * withdrawing is allowed, and the screen separates what stays (XP, level,
 * items, non-streak badges) from what was removed (streak badges).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LUNA_PER_NIM } from '@/lib/constants'
import { BADGES } from '@/lib/game/badges'
import { takeWithdrawalHandoff, type WithdrawalHandoff } from '@/lib/checkin-handoff'
import { Glyph } from '@/components/Glyphs'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { ButtonLink } from '@/components/ui/Button'

export default function WithdrawalPage() {
  const router = useRouter()
  const [state, setState] = useState<WithdrawalHandoff | null>(null)

  useEffect(() => {
    const handoff = takeWithdrawalHandoff()
    if (!handoff) {
      router.replace('/')
      return
    }
    setState(handoff)
  }, [router])

  if (!state) {
    return (
      <ScreenShell variant="pushed">
        <p className="sv-body text-fg-muted">Loading…</p>
      </ScreenShell>
    )
  }

  const removed = state.revoked
    .map((key) => BADGES.find((badge) => badge.key === key))
    .filter((badge): badge is (typeof BADGES)[number] => Boolean(badge))

  return (
    <ScreenShell variant="pushed">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <PixelPanel className="w-28 h-28 flex items-center justify-center" wrapperClassName="shrink-0">
          <Glyph name="withdrawal" size={56} />
        </PixelPanel>
        <h1 className="sv-number-xl">Your balance went down</h1>
        <p className="sv-body text-fg-muted">
          You can withdraw any time.{' '}
          {state.revoked.length > 0
            ? 'Your streak badge is removed, but the rest stays with you.'
            : 'The rest stays with you.'}
        </p>
      </div>

      <PixelPanel className="p-4 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="sv-label text-fg-muted">Last check-in</span>
          <span className="sv-number-m">
            {formatNim(state.fromLuna)}{' '}
            <span className="sv-label text-fg-muted">NIM</span>
          </span>
        </div>
        <Glyph name="withdrawal" size={24} />
        <div className="flex flex-col gap-1 text-right">
          <span className="sv-label text-fg-muted">Now</span>
          <span className="sv-number-m text-coral-text">
            {formatNim(state.toLuna)}{' '}
            <span className="sv-label text-fg-muted">NIM</span>
          </span>
        </div>
      </PixelPanel>

      <PixelPanel className="p-3.5 flex flex-col gap-2">
        <span className="sv-label text-mint">Still yours</span>
        <span className="sv-label text-fg-soft">
          Your XP, level, items and other badges. Items stay after a withdrawal.
        </span>
      </PixelPanel>

      <PixelPanel className="p-3.5 flex flex-col gap-2">
        <span className="sv-label text-coral-text">Removed</span>
        {removed.length > 0 ? (
          <span className="sv-label text-fg-soft">
            {removed.map((badge) => badge.name).join(', ')}. This week&apos;s Steady Saver
            mission resets.
          </span>
        ) : (
          <span className="sv-label text-fg-soft">
            No badges were removed. Your streak and missions stay.
          </span>
        )}
      </PixelPanel>

      <ButtonLink href="/" variant="primary">
        Got it
      </ButtonLink>
    </ScreenShell>
  )
}

function formatNim(luna: number): string {
  return (luna / LUNA_PER_NIM).toFixed(2)
}
