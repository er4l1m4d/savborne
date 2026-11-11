/**
 * Savborne - Battle menu
 *
 * Three modes as cards: Ranked, Friend and AI. Ranked is coral when eligible;
 * when locked it becomes an off panel with Level and Check-in meters, and AI
 * becomes the coral action. At the daily limit all three are off and a coral
 * panel carries the reset countdown and a Missions link.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { usePlayerSession } from '@/lib/usePlayerSession'
import { BATTLE, BRACKETS, RANKED, type Bracket } from '@/lib/constants'
import { battlesLeft, formatCountdown, nextUtcMidnight, rankedEligible, rankedProgress } from '@/lib/battle-ui'
import { rivalForBattle } from '@/lib/game/rivals'
import { Glyph } from '@/components/Glyphs'
import { RivalArt } from '@/components/RivalArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Chip } from '@/components/ui/Chip'
import { ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Meter } from '@/components/ui/Meter'
import { ModeCard } from '@/components/battle/ModeCard'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiFetch } from '@/lib/client-session'

export default function BattleMenuPage() {
  const router = useRouter()
  const { player, loading, error: sessionError, refresh } = usePlayerSession()
  const [busy, setBusy] = useState<'friend' | 'ai' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const left = battlesLeft(player?.battlesToday ?? 0)
  const limitReached = left === 0
  const bracket = (player?.bracket as Bracket | null) ?? null
  const eligible = !!player && rankedEligible({
    level: player.level,
    checkInCount: player.checkInCount,
    bracket,
  })
  const progress = rankedProgress({
    level: player?.level ?? 1,
    checkInCount: player?.checkInCount ?? 0,
  })

  // The reset countdown needs a tick, but it only changes every minute.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // At 00:00 UTC the daily counter resets server-side; refresh without a reload.
  useEffect(() => {
    if (!limitReached) return
    const ms = nextUtcMidnight(new Date()).getTime() - Date.now()
    const id = setTimeout(() => void refresh(), Math.max(1_000, ms + 1_000))
    return () => clearTimeout(id)
  }, [limitReached, refresh])

  async function createChallenge() {
    setBusy('friend')
    setError(null)
    try {
      const res = await apiFetch('/api/battles/friend', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      router.push(`/battle/friend/${json.battleId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create challenge')
    } finally {
      setBusy(null)
    }
  }

  async function startAiBattle() {
    setBusy('ai')
    setError(null)
    try {
      const res = await apiFetch('/api/battles/ai', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      router.push(`/battle/${json.battleId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start battle')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <ScreenShell variant="tab" title="Battle">
        <LoadingState />
      </ScreenShell>
    )
  }

  if (!player) {
    return (
      <ScreenShell variant="tab" title="Battle">
        <Banner tone="error">{sessionError ?? 'Could not load your player.'}</Banner>
        <ButtonLink href="/" variant="secondary">
          Go to Home
        </ButtonLink>
      </ScreenShell>
    )
  }

  const resetMs = nextUtcMidnight(new Date(now)).getTime() - now

  return (
    <ScreenShell
      variant="tab"
      title="Battle"
      actions={
        <Chip variant="outline" color={limitReached ? 'var(--coral-text)' : undefined}>
          {left} battles left today
        </Chip>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}

      {limitReached ? (
        <>
          <DailyLimit resetMs={resetMs} />
          <ModeCard
            title={eligible ? 'Ranked' : 'Ranked · Locked'}
            blurb={
              eligible
                ? 'Find a ranked match in your bracket.'
                : `Reach Level ${RANKED.minLevel} and complete ${RANKED.minCheckIns} check-ins to unlock ranked battles.`
            }
            icon={eligible ? <Glyph name="ranked" size={36} /> : <Glyph name="lock" size={36} />}
          />
          <ModeCard
            title="Friend"
            blurb="Challenge a friend. Unranked."
            icon={<Glyph name="friend" size={36} />}
          />
          <ModeCard
            title="AI Opponent"
            blurb="Battle the Savborne AI. Unranked."
            icon={<RivalArt rival={rivalForBattle(player.address)} size={32} />}
          />
          <ButtonLink href="/missions" variant="secondary">
            Go to Missions
          </ButtonLink>
        </>
      ) : (
        <>
          {eligible && bracket ? (
            <ModeCard
              title="Ranked"
              blurb="Find a ranked match in your bracket."
              meta={`Rating ${player.rating} · ${BRACKETS[bracket].label}`}
              icon={<Glyph name="ranked" size={36} />}
              primary
              onClick={() => router.push('/battle/queue')}
              disabled={busy !== null}
            />
          ) : (
            <>
              <ModeCard
                title="Ranked · Locked"
                blurb={`Reach Level ${RANKED.minLevel} and complete ${RANKED.minCheckIns} check-ins to unlock ranked battles.`}
                icon={<Glyph name="lock" size={36} />}
                extra={
                  <div className="mt-1 flex flex-col gap-2.5">
                    <RankedBar bar={progress.level} />
                    <RankedBar bar={progress.checkIns} />
                    {bracket === null && (
                      <p className="sv-label text-fg-muted">
                        Add at least 1 NIM to your savings account to unlock ranked.
                      </p>
                    )}
                  </div>
                }
              />
              <ButtonLink href="/missions" variant="secondary">
                Go to Missions
              </ButtonLink>
            </>
          )}

          <ModeCard
            title="Friend"
            blurb="Challenge a friend. Unranked."
            icon={<Glyph name="friend" size={36} />}
            onClick={createChallenge}
            disabled={busy !== null}
          />

          <ModeCard
            title="AI Opponent"
            blurb="Battle the Savborne AI. Unranked."
            icon={<RivalArt rival={rivalForBattle(player.address)} size={32} />}
            primary={!eligible}
            onClick={startAiBattle}
            disabled={busy !== null}
          />

          <PixelPanel tone="off" className="p-3.5">
            <p className="sv-label text-fg-muted">
              Battles reset at 00:00 UTC (1:00 AM Lagos time). Ranked, friend and AI
              battles all count toward the daily limit of {BATTLE.dailyLimit}.
            </p>
          </PixelPanel>
        </>
      )}
    </ScreenShell>
  )
}

function RankedBar({ bar }: { bar: { value: number; max: number; label: string } }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2">
        <span className="sv-label text-fg">{bar.label}</span>
        <span className="sv-label text-fg-muted">
          {bar.value} of {bar.max}
        </span>
      </div>
      <Meter
        value={bar.value}
        max={bar.max}
        label={`${bar.label} progress`}
        height={14}
      />
    </div>
  )
}

function DailyLimit({ resetMs }: { resetMs: number }) {
  return (
    <PixelPanel tone="coral" className="flex flex-col gap-3.5 p-4">
      <div
        className="flex gap-2"
        role="img"
        aria-label={`${BATTLE.dailyLimit} of ${BATTLE.dailyLimit} battles used`}
      >
        {Array.from({ length: BATTLE.dailyLimit }, (_, index) => (
          <span key={index} className="h-3 flex-1 bg-coral" />
        ))}
      </div>
      <p className="sv-subheading">
        You&apos;ve started {BATTLE.dailyLimit} battles today. New battles unlock at 00:00 UTC
        (1:00 AM Lagos time).
      </p>
      <div className="flex items-baseline justify-between gap-3">
        <span className="sv-label text-fg-muted">Next battles in</span>
        <span className="sv-figure">{formatCountdown(resetMs)}</span>
      </div>
    </PixelPanel>
  )
}
