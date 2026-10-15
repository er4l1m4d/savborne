/**
 * Savborne — Profile screen
 *
 * Shows identity, bracket, level, XP, rating, and win/loss/tie record; a
 * grid of all eight items (locked and unlocked); a horizontal strip of the
 * six badges with awarded state. Pulls from `GET /api/profile`.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { BRACKETS, LUNA_PER_NIM, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { BADGES, type BadgeKey } from '@/lib/game/badges'

type ProfileData = {
  player: {
    address: string
    displayName: string
    level: number
    xp: number
    rating: number
    bracket: Bracket | null
    balanceLuna: number
    streakCurrent: number
    streakBest: number
    checkInCount: number
    wins: number
    losses: number
    ties: number
  }
  ownedItems: ItemKey[]
  activeBadges: BadgeKey[]
}

export default function ProfilePage() {
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/profile', { headers: authHeaders() })
        if (res.status === 401) {
          router.replace('/setup')
          return
        }
        if (!res.ok) throw new Error(`${res.status}`)
        const json = (await res.json()) as ProfileData
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center text-fg-muted text-sm">
        Loading your profile…
      </main>
    )
  }
  if (error || !data) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-(--gut)">
        <div className="vpx bg-coral-tint p-4 text-coral-text text-sm">
          {error ?? 'No data'}
        </div>
      </main>
    )
  }

  const ownedSet = new Set(data.ownedItems)
  const activeSet = new Set(data.activeBadges)

  return (
    <main className="p-(--gut) max-w-105 mx-auto w-full flex flex-col gap-5">
      <IdentityStrip data={data} />
      <StatGrid data={data} />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mint">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((b) => {
            const active = activeSet.has(b.key)
            return (
              <div
                key={b.key}
                className={`vpx-soft p-2 flex flex-col items-center gap-1 text-center ${
                  active ? 'bg-surface-hi' : 'bg-surface opacity-40'
                }`}
                title={b.description}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {active ? '◈' : '◇'}
                </span>
                <span className="text-[10px] font-bold leading-tight">{b.name}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mint">Inventory</h2>
        <ul className="flex flex-col gap-2">
          {ITEMS.map((it) => {
            const unlocked = ownedSet.has(it.key)
            return (
              <li
                key={it.key}
                className={`vpx-soft p-3 flex items-start gap-3 ${
                  unlocked ? 'bg-surface' : 'bg-surface-low opacity-60'
                }`}
              >
                <span
                  className="shrink-0 inline-block w-2 h-2 mt-2"
                  style={{ background: unlocked ? BRACKETS[it.bracket].color : 'var(--bevel-soft)' }}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-sm font-bold truncate ${
                        unlocked ? 'text-foreground' : 'text-fg-muted'
                      }`}
                    >
                      {it.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-fg-faint shrink-0">
                      {it.bracket}
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted leading-snug mt-1">
                    {unlocked ? it.blurb : `Locked: reach ${it.bracket} to unlock.`}
                  </p>
                  {unlocked && !it.isBadge && (
                    <p className="text-[10px] text-mint mt-1">Active in battles.</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="text-[10px] text-fg-faint text-center leading-relaxed pt-2 border-t border-line">
        Your address: <span className="font-mono">{short(data.player.address)}</span>
        <br />
        Items stay yours even if your balance drops.
      </p>
    </main>
  )
}

function IdentityStrip({ data }: { data: ProfileData }) {
  const b = data.player.bracket
  return (
    <header className="flex items-baseline justify-between gap-3 mt-4">
      <div className="flex flex-col gap-1 min-w-0">
        <h1
          className="text-3xl leading-none truncate"
          style={{ fontFamily: 'var(--font-silkscreen)' }}
        >
          {data.player.displayName}
        </h1>
        <p className="text-xs text-fg-muted">Level {data.player.level}</p>
      </div>
      {b && (
        <span
          className="vpx-soft inline-flex items-center h-8 px-3 text-xs font-bold uppercase tracking-wider bg-surface shrink-0"
          style={{ color: BRACKETS[b].color }}
        >
          {BRACKETS[b].label}
        </span>
      )}
    </header>
  )
}

function StatGrid({ data }: { data: ProfileData }) {
  const { player } = data
  const nim = player.balanceLuna / LUNA_PER_NIM
  return (
    <section className="grid grid-cols-3 gap-2">
      <Stat label="Rating" value={player.rating} />
      <Stat label="Balance" value={`${nim.toFixed(2)} NIM`} />
      <Stat label="Streak" value={`${player.streakCurrent}d`} />
      <Stat label="Wins" value={player.wins} />
      <Stat label="Losses" value={player.losses} />
      <Stat label="Ties" value={player.ties} />
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="vpx-soft bg-surface p-2 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-fg-faint">{label}</span>
      <span className="num text-base font-bold truncate">{value}</span>
    </div>
  )
}

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
