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
import { getBalance, WalletError } from '@/lib/nimiq'
import { authHeaders } from '@/lib/session'
import { usePlayerSession, type PlayerMe } from '@/lib/usePlayerSession'
import { BRACKETS, LUNA_PER_NIM, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { BADGES, type BadgeAction } from '@/lib/game/badges'

type AwardSummary = {
  awarded: { key: string; xpApplied: number; xpCapped: number; onetime: boolean }[]
  leveledUp: boolean
  newLevel: number
  bracketChanged: boolean
  withdrawalDetected: boolean
  balanceLuna: number
  unlockedItems: ItemKey[]
  badgeActions: BadgeAction[]
}

export default function HomePage() {
  const router = useRouter()
  const { session, player, loading, needsReconnect, error, refresh } = usePlayerSession()
  const [checking, setChecking] = useState(false)
  const [awards, setAwards] = useState<AwardSummary | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

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
      const luna = await getBalance(session.savingsAddress)
      const res = await fetch('/api/check-ins', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ balanceLuna: luna }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Check-in failed (${res.status}): ${text}`)
      }
      const json = (await res.json()) as AwardSummary & { ok: true }
      setAwards(json)
      await refresh()
    } catch (err) {
      setCheckError(describeError(err))
    } finally {
      setChecking(false)
    }
  }

  if (loading || !player) {
    return (
      <main className="min-h-dvh flex items-center justify-center text-fg-muted text-sm">
        Loading your character…
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-[var(--gut)]">
        <div className="vpx bg-coral-tint p-4 text-coral-text text-sm">{error}</div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col gap-5 p-[var(--gut)] max-w-[420px] mx-auto w-full">
      <Header player={player} />
      <Chips player={player} />
      <XpBar player={player} />
      <BalanceCard player={player} />

      {awards && <AwardsPanel awards={awards} />}
      {checkError && (
        <div className="vpx bg-coral-tint p-3 text-coral-text text-sm">{checkError}</div>
      )}

      <button
        onClick={onCheckIn}
        disabled={checking}
        className="vpx bg-mint text-[#0E1D19] py-4 px-4 font-bold text-lg active:translate-y-[2px] disabled:opacity-40"
        style={{ boxShadow: '0 3px 0 var(--bevel-shadow)' }}
      >
        {checking ? 'Reading balance…' : 'Check In'}
      </button>

      <p className="text-[11px] text-fg-faint text-center leading-relaxed">
        Checking in reads the balance of your savings account and records one
        snapshot. Savborne never moves your money.
      </p>
    </main>
  )
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function Header({ player }: { player: PlayerMe }) {
  return (
    <header className="flex items-baseline justify-between mt-4">
      <h1
        className="text-2xl leading-none truncate max-w-[70%]"
        style={{ fontFamily: 'var(--font-silkscreen)' }}
      >
        {player.displayName}
      </h1>
      <span className="text-xs text-fg-muted uppercase tracking-widest">
        Level {player.level}
      </span>
    </header>
  )
}

function Chips({ player }: { player: PlayerMe }) {
  const bracket = player.bracket as Bracket | null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {bracket && (
        <span
          className="vpx-soft inline-flex items-center gap-1 h-8 px-3 text-xs font-bold uppercase tracking-wider bg-surface"
          style={{ color: BRACKETS[bracket].color }}
        >
          {BRACKETS[bracket].label}
        </span>
      )}
      <span className="vpx-soft inline-flex items-center gap-1 h-8 px-3 text-xs font-bold bg-surface text-butter-text">
        🔥 {player.streakCurrent} day{player.streakCurrent === 1 ? '' : 's'}
      </span>
      <span className="vpx-soft inline-flex items-center gap-1 h-8 px-3 text-xs font-bold bg-surface text-fg-muted">
        {player.checkInCount} check-in{player.checkInCount === 1 ? '' : 's'}
      </span>
    </div>
  )
}

function XpBar({ player }: { player: PlayerMe }) {
  const prevLevelXp = cumulativeToLevel(player.level)
  const inLevel = player.xp - prevLevelXp
  const pct = Math.min(100, Math.round((inLevel / player.xpToNext) * 100))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[11px] text-fg-faint uppercase tracking-widest">
        <span>XP</span>
        <span className="num">
          {inLevel} / {player.xpToNext}
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
    <section className="vpx bg-surface p-4 flex flex-col gap-1">
      <h2 className="text-[11px] uppercase tracking-widest text-fg-faint font-bold">
        Savings balance
      </h2>
      <p className="num text-3xl font-bold text-foreground leading-tight">
        {nim.toFixed(5)} <span className="text-base text-fg-muted">NIM</span>
      </p>
      <p className="text-[11px] text-fg-faint">Last check-in: {last} UTC</p>
    </section>
  )
}

function AwardsPanel({ awards }: { awards: AwardSummary }) {
  const totalXp = awards.awarded.reduce((s, a) => s + a.xpApplied, 0)
  const cappedCount = awards.awarded.filter((a) => a.xpCapped > 0).length
  return (
    <section className="vpx bg-mint-tint p-4 flex flex-col gap-2">
      <h2 className="text-sm font-bold text-mint">
        +{totalXp} XP{awards.leveledUp ? ` — Level up! Now level ${awards.newLevel}` : ''}
      </h2>
      <ul className="text-xs text-fg-soft flex flex-col gap-1">
        {awards.awarded.length === 0 && <li>Checked in. Balance recorded.</li>}
        {awards.awarded.map((a) => (
          <li key={a.key} className="flex justify-between gap-2">
            <span className="capitalize">{a.key.replace(/_/g, ' ')}</span>
            <span className="num text-mint">+{a.xpApplied}</span>
          </li>
        ))}
      </ul>
      {cappedCount > 0 && (
        <p className="text-[11px] text-fg-faint">
          Some XP was capped by the daily/weekly mission limits.
        </p>
      )}
      {awards.bracketChanged && (
        <p className="text-[11px] text-butter-text">
          Your bracket changed — check your inventory for new items.
        </p>
      )}
      {awards.withdrawalDetected && (
        <p className="text-[11px] text-coral-text">
          Balance dropped since your last check-in. Streak badges are removed;
          everything else stays.
        </p>
      )}
      {awards.unlockedItems.length > 0 && (
        <ul className="text-[11px] text-butter-text flex flex-col gap-0.5 pt-1 border-t border-line">
          <li className="uppercase tracking-widest font-bold">New items unlocked</li>
          {awards.unlockedItems.map((k) => {
            const it = ITEMS.find((i) => i.key === k)
            return it ? <li key={k}>◈ {it.name} — {it.blurb}</li> : null
          })}
        </ul>
      )}
      {awards.badgeActions.length > 0 && (
        <ul className="text-[11px] text-mint flex flex-col gap-0.5 pt-1 border-t border-line">
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
    </section>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Cumulative XP a player had already spent on the way to reaching `level`.
 * Mirrors cumulativeXpForLevel in constants.ts, but avoids a server-only
 * import path in this client component.
 */
function cumulativeToLevel(level: number): number {
  let total = 0
  for (let n = 1; n < level; n++) total += 25 * (n + 1)
  return total
}

function describeError(err: unknown): string {
  if (err instanceof WalletError) {
    switch (err.type) {
      case 'NETWORK_ERROR':
        return 'The Nimiq network is busy. Try checking in again in a moment.'
      case 'PERMISSION_DENIED':
        return 'Wallet access declined. Reconnect your savings account from the Profile tab.'
      default:
        return err.message || 'Could not read your balance.'
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong. Try again.'
}
