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
import { BRACKETS, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { BADGES, type BadgeKey } from '@/lib/game/badges'
import { BadgeArt } from '@/components/Glyphs'
import { TOUR_FLAG_KEY } from '@/components/VaultTour'
import { BackupSettings } from '@/components/vault/BackupSettings'

/** Single definition; the footer and the mailto both read it. */
const CONTACT_EMAIL = 'damilareogooluwade@outlook.com'

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
  /** Minted once, server-side, at vault creation. `null` for a player with no vault. */
  cardToken: string | null
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
                  active ? 'bg-surface-hi' : 'bg-surface'
                }`}
                title={b.description}
              >
                {/* The locked drawing is already a muted two-tone, so no extra dimming here —
                    an opacity-40 on top of it double-dims a state the art already carries. */}
                <BadgeArt badge={b.key} state={active ? 'earned' : 'locked'} size={32} />
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

      <ShareCardSection cardToken={data.cardToken} />

      <BackupSettings />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mint">Help</h2>
        <button
          onClick={() => {
            try {
              window.localStorage.removeItem(TOUR_FLAG_KEY)
            } catch {
              // Non-fatal.
            }
            router.push('/vault')
          }}
          className="vpx-soft bg-surface py-3 px-4 font-bold text-sm text-left"
        >
          Show tour again
        </button>
      </section>

      <footer className="flex flex-col items-center gap-1 pt-4 border-t border-line text-[11px] text-fg-faint">
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-mint underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        <p className="text-center leading-relaxed">
          Savborne never holds your NIM. A 24-word phrase generated on your device controls your
          vault. Balances are read from the chain, never stored by us.
        </p>
        <p>
          Your address: <span className="font-mono">{short(data.player.address)}</span>
        </p>
      </footer>
    </main>
  )
}

/**
 * The share entry. The token is minted once, server-side, at vault creation —
 * the card page never invents one. `navigator.share()` is used where the
 * platform offers it; copy-to-clipboard is the fallback.
 */
function ShareCardSection({ cardToken }: { cardToken: string | null }) {
  const [copied, setCopied] = useState(false)

  const url = cardToken && typeof window !== 'undefined'
    ? `${window.location.origin}/card/${cardToken}`
    : null

  async function share() {
    if (!url) return
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'My Savborne card', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // A cancelled share is not an error worth showing.
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold uppercase tracking-widest text-mint">Share</h2>
      <button
        onClick={share}
        disabled={!url}
        className="vpx bg-surface-hi py-3 px-4 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed text-left"
      >
        {cardToken
          ? copied
            ? 'Link copied to clipboard'
            : 'Share my card'
          : 'Create a vault to share your card'}
      </button>
      {url && <p className="text-[10px] font-mono text-fg-faint break-all">{url}</p>}
      <p className="text-[11px] text-fg-faint">
        Your card shows your name, level, streak and bracket — never your balance.
      </p>
    </section>
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
  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Rating" value={player.rating} />
        <Stat label="Wins" value={player.wins} />
        <Stat label="Check-ins" value={player.checkInCount} />
      </div>
      {/* Wins/Losses/Ties used to be three tiles of their own. The documented profile shows
          three tiles total, so the record collapses to one line rather than being dropped. */}
      <p className="text-[11px] font-bold tracking-wide text-fg-muted num text-right">
        {player.wins}W · {player.losses}L · {player.ties}T
      </p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="vpx bg-surface-low p-3 flex flex-col gap-1">
      <span
        className="text-xl leading-none"
        style={{ fontFamily: 'var(--font-silkscreen)' }}
      >
        {value}
      </span>
      <span className="text-xs font-bold text-fg-muted">{label}</span>
    </div>
  )
}

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
