/**
 * Savborne — Home screen
 *
 * Renders the player's current state (balance, level, XP bar, streak, bracket)
 * and the "Check In" button. Also redirects to /setup if the user has not
 * connected a savings account yet, and back to setup if the stored session
 * no longer matches the wallet.
 *
 * Awards summary from the check-in POST is displayed inline as a panel and
 * replaced on the next check-in.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WalletError } from '@/lib/nimiq'
import { authHeaders } from '@/lib/session'
import { usePlayerSession, type PlayerMe } from '@/lib/usePlayerSession'
import { BRACKETS, LUNA_PER_NIM, xpProgress, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { BADGES, type BadgeAction } from '@/lib/game/badges'
import { SHIELD_CAP } from '@/lib/game/streaks'
import {
  checkInDestination,
  takeCheckInAwards,
  writeBracketHandoff,
  writeCheckInAwards,
  writeWithdrawalHandoff,
} from '@/lib/checkin-handoff'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Banner } from '@/components/ui/Banner'

type MissionStatus = {
  key: string
  name: string
  completed: boolean
  xpReward: number
}

type AwardSummary = {
  awarded: { key: string; xpApplied: number; xpCapped: number; onetime: boolean }[]
  leveledUp: boolean
  newLevel: number
  bracketChanged: boolean
  withdrawalDetected: boolean
  bracket: Bracket | null
  previousBracket: Bracket | null
  balanceLuna: number
  previousBalanceLuna: number | null
  unlockedItems: ItemKey[]
  badgeActions: BadgeAction[]
}

export default function HomePage() {
  const router = useRouter()
  const { session, player, loading, needsReconnect, error, refresh } = usePlayerSession()
  const [checking, setChecking] = useState(false)
  const [awards, setAwards] = useState<AwardSummary | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [dailyMissions, setDailyMissions] = useState<MissionStatus[] | null>(null)

  // Redirect rules — kept here (not in middleware) because the session lives
  // in localStorage and cannot be read server-side.
  useEffect(() => {
    if (loading) return
    if (needsReconnect || session === null) router.replace('/setup')
  }, [loading, needsReconnect, session, router])

  async function onCheckIn() {
    if (!session) return
    setChecking(true)
    setCheckError(null)
    setAwards(null)
    try {
      const res = await fetch('/api/check-ins', {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Check-in failed (${res.status}): ${text}`)
      }
      const json = (await res.json()) as AwardSummary & { ok: true }
      await refresh()

      const destination = checkInDestination(json)
      if (destination === 'withdrawal') {
        const stored = writeWithdrawalHandoff({
          fromLuna: json.previousBalanceLuna ?? player?.balanceLuna ?? json.balanceLuna,
          toLuna: json.balanceLuna,
          revoked: json.badgeActions
            .filter((action) => action.kind === 'revoke')
            .map((action) => action.badge),
        })
        if (stored) {
          writeCheckInAwards(json)
          router.push('/withdrawal')
          return
        }
      }
      if (destination === 'bracket-climb' && json.bracket) {
        const stored = writeBracketHandoff({
          bracket: json.bracket,
          xp: json.awarded.find((award) => award.key === 'bracket_climb')?.xpApplied ?? 0,
          items: json.unlockedItems,
        })
        if (stored) {
          writeCheckInAwards(json)
          router.push('/bracket-climb')
          return
        }
      }

      setAwards(json)
      void fetchDailyMissions()
    } catch (err) {
      setCheckError(describeError(err))
    } finally {
      setChecking(false)
    }
  }

  async function fetchDailyMissions() {
    try {
      const res = await fetch('/api/missions', { headers: authHeaders() })
      if (!res.ok) return
      const json = (await res.json()) as {
        missions: { key: string; name: string; completed: boolean; xp_reward: number }[]
        counters: { dailyXpEarned: number }
      }
      const filtered = (json.missions ?? [])
        .filter((m) => m.key === 'daily_check_in' || m.key === 'quick_duel')
        .map((m) => ({ key: m.key, name: m.name, completed: m.completed, xpReward: m.xp_reward }))
      setDailyMissions(filtered)
    } catch {
      /* non-fatal — daily missions are supplementary */
    }
  }

  useEffect(() => {
    const stored = takeCheckInAwards<AwardSummary>()
    if (stored) setAwards(stored)
    void fetchDailyMissions()
  }, [])

  if (loading || !player) {
    return (
      <ScreenShell variant="tab">
        <p className="sv-body text-fg-muted">Loading your character…</p>
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell variant="tab">
        <Banner tone="error">{error}</Banner>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell
      variant="tab"
      title={player.displayName}
      actions={<span className="sv-label text-fg-muted">Level {player.level}</span>}
    >
      <Chips player={player} />
      <XpBar player={player} />
      <BalanceCard player={player} />
      {dailyMissions && <DailyMissions missions={dailyMissions} />}

      {awards && <AwardsPanel awards={awards} />}
      {checkError && <Banner tone="error">{checkError}</Banner>}

      <Button variant="primary" size="lg" onClick={onCheckIn} loading={checking}>
        {checking ? 'Reading balance…' : 'Check In'}
      </Button>

      <p className="sv-label text-fg-faint text-center">
        Checking in reads the balance of your savings account and records one
        snapshot. Savborne never moves your money.
      </p>
    </ScreenShell>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function Chips({ player }: { player: PlayerMe }) {
  const bracket = player.bracket as Bracket | null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {bracket && (
        <Chip variant="outline" color={BRACKETS[bracket].color}>
          {BRACKETS[bracket].label}
        </Chip>
      )}
      <Chip variant="outline" color="var(--butter-text)">
        🔥 {player.streakCurrent} day{player.streakCurrent === 1 ? '' : 's'}
      </Chip>
      <span
        aria-label={`${player.shields} of ${SHIELD_CAP} streak shields`}
        title="Each shield absorbs one missed day"
      >
        <Chip variant="outline">
          <span aria-hidden className="flex items-center gap-1.5">
            {Array.from({ length: SHIELD_CAP }, (_, i) => (
              <span
                key={i}
                className={i < player.shields ? 'text-mint' : 'text-fg-faint opacity-40'}
              >
                ◈
              </span>
            ))}
            <span className="sv-label text-fg-faint">Shields</span>
          </span>
        </Chip>
      </span>
      <Chip variant="outline" color="var(--fg-muted)">
        {player.checkInCount} check-in{player.checkInCount === 1 ? '' : 's'}
      </Chip>
    </div>
  )
}

function XpBar({ player }: { player: PlayerMe }) {
  const { inLevel, toNext } = xpProgress(player.level, player.xp)
  const pct = Math.min(100, Math.round((inLevel / toNext) * 100))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-fg-faint">
        <span className="sv-label">XP</span>
        <span className="sv-figure">
          {inLevel} / {toNext}
        </span>
      </div>
      <div className="vpx-soft h-3 bg-surface-low overflow-hidden">
        <div
          className="h-full bg-mint transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function BalanceCard({ player }: { player: PlayerMe }) {
  const nim = player.balanceLuna / LUNA_PER_NIM
  const last = player.lastCheckInAt
    ? new Date(player.lastCheckInAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      })
    : 'Not yet'
  return (
    <PixelPanel className="p-4 flex flex-col gap-1">
      <h2 className="sv-section-label text-fg-faint">Savings balance</h2>
      <p className="sv-number-xl text-foreground">
        {nim.toFixed(5)} <span className="text-base text-fg-muted">NIM</span>
      </p>
      <p className="sv-label text-fg-faint">Last check-in: {last} UTC</p>
      <ButtonLink href="/vault" variant="ghost" className="self-start">
        Open vault
      </ButtonLink>
    </PixelPanel>
  )
}

function DailyMissions({ missions }: { missions: MissionStatus[] }) {
  const completed = missions.filter((m) => m.completed).length
  const total = missions.reduce((s, m) => s + m.xpReward, 0)
  const earned = missions.filter((m) => m.completed).reduce((s, m) => s + m.xpReward, 0)
  const pct = Math.min(100, Math.round((earned / total) * 100))
  return (
    <PixelPanel className="p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="sv-section-label text-fg-faint">Daily missions</h2>
        <span className="sv-figure text-fg-muted">
          {completed}/{missions.length} · {earned} / {total} XP
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {missions.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3">
            <span className={`sv-label min-w-0 ${m.completed ? 'text-mint' : 'text-fg-muted'}`}>
              {m.completed ? '✓' : '·'} {m.name}
            </span>
            <span className={`sv-figure ${m.completed ? 'text-mint' : 'text-butter-text'}`}>
              +{m.xpReward}
            </span>
          </div>
        ))}
      </div>
      <div className="h-1.5 bg-surface-low overflow-hidden">
        <div
          className="h-full bg-mint transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </PixelPanel>
  )
}

function AwardsPanel({ awards }: { awards: AwardSummary }) {
  const totalXp = awards.awarded.reduce((s, a) => s + a.xpApplied, 0)
  const cappedCount = awards.awarded.filter((a) => a.xpCapped > 0).length
  return (
    <PixelPanel tone="mint" className="p-4 flex flex-col gap-2">
      <h2 className="sv-subheading text-mint">
        +{totalXp} XP{awards.leveledUp ? ` — Level up! Now level ${awards.newLevel}` : ''}
      </h2>
      <ul className="sv-label text-fg-soft flex flex-col gap-1">
        {awards.awarded.length === 0 && <li>Checked in. Balance recorded.</li>}
        {awards.awarded.map((a) => (
          <li key={a.key} className="flex justify-between gap-2">
            <span className="capitalize">{a.key.replace(/_/g, ' ')}</span>
            <span className="num text-mint">+{a.xpApplied}</span>
          </li>
        ))}
      </ul>
      {cappedCount > 0 && (
        <p className="sv-label text-fg-faint">
          Some XP was capped by the daily/weekly mission limits.
        </p>
      )}
      {awards.bracketChanged && (
        <p className="sv-label text-butter-text">
          Your bracket changed — check your inventory for new items.
        </p>
      )}
      {awards.withdrawalDetected && (
        <p className="sv-label text-coral-text">
          Balance dropped since your last check-in. Streak badges are removed;
          everything else stays.
        </p>
      )}
      {awards.unlockedItems.length > 0 && (
        <ul className="sv-label text-butter-text flex flex-col gap-0.5 pt-1 border-t border-line">
          <li className="uppercase tracking-widest font-bold">New items unlocked</li>
          {awards.unlockedItems.map((k) => {
            const it = ITEMS.find((i) => i.key === k)
            return it ? <li key={k}>◈ {it.name} — {it.blurb}</li> : null
          })}
        </ul>
      )}
      {awards.badgeActions.length > 0 && (
        <ul className="sv-label text-mint flex flex-col gap-0.5 pt-1 border-t border-line">
          <li className="uppercase tracking-widest font-bold">Badges</li>
          {awards.badgeActions.map((a) => {
            const b = BADGES.find((x) => x.key === a.badge)
            const label = `${a.kind === 'award' ? '◈ Earned' : '◇ Revoked'}: ${b?.name ?? a.badge}`
            return (
              <li key={`${a.kind}-${a.badge}`} className={a.kind === 'revoke' ? 'text-coral-text' : ''}>
                {label}
              </li>
            )
          })}
        </ul>
      )}
    </PixelPanel>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function describeError(err: unknown): string {
  if (err instanceof WalletError) {
    switch (err.type) {
      case 'NETWORK_ERROR':
        return 'The Nimiq network is busy. Try checking in again in a moment.'
      case 'PERMISSION_DENIED':
        return 'Wallet access declined. Reconnect your wallet in Nimiq Pay and try again.'
      default:
        return err.message || 'Could not read your balance.'
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong. Try again.'
}
