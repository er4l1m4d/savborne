/**
 * Savborne — Profile screen
 *
 * Shows the character card, bracket, level, XP, rating and win/loss/tie record;
 * the six badges; and a shortcut to the Items screen. Pulls from
 * `GET /api/profile`.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { BRACKETS, RANKED, xpProgress, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { BADGES, type BadgeKey } from '@/lib/game/badges'
import { BadgeArt, Glyph } from '@/components/Glyphs'
import type { Avatar } from '@/lib/avatar'
import { CharacterArt } from '@/components/CharacterArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Chip } from '@/components/ui/Chip'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

type ProfileData = {
  player: {
    address: string
    displayName: string
    avatar: Avatar
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
      <ScreenShell variant="tab">
        <p className="sv-body text-fg-muted">Loading your profile…</p>
      </ScreenShell>
    )
  }

  if (error || !data) {
    return (
      <ScreenShell variant="tab">
        <Banner tone="error">{error ?? 'No data'}</Banner>
      </ScreenShell>
    )
  }

  const activeSet = new Set(data.activeBadges)
  const ownedSet = new Set<ItemKey>(data.ownedItems)
  if (activeSet.has('golden_crown')) ownedSet.add('golden_crown')

  const b = data.player.bracket
  const bracketLabel = b ? BRACKETS[b].label : 'No bracket'
  const { inLevel, toNext: xpToNext } = xpProgress(data.player.level, data.player.xp)
  const xpPct = Math.min(100, Math.round((inLevel / xpToNext) * 100))
  const rankedUnlocked =
    data.player.level >= RANKED.minLevel && data.player.checkInCount >= RANKED.minCheckIns

  return (
    <ScreenShell
      variant="tab"
      title="Profile"
      actions={
        <ButtonLink href="/settings" variant="icon" aria-label="Settings">
          <Glyph name="flag" size={24} />
        </ButtonLink>
      }
    >
      <PixelPanel className="p-4 flex items-center gap-4">
        <div
          className="w-28 h-[148px] shrink-0 flex items-center justify-center"
          style={{ background: 'var(--sprite-well)' }}
        >
          <CharacterArt bracket={b} character={data.player.avatar} />
        </div>
        <div className="min-w-0 flex flex-1 flex-col gap-1.5">
          <h2 className="sv-heading sv-break">{data.player.displayName}</h2>
          <p className="sv-label text-fg-muted">
            Level {data.player.level} · {bracketLabel} bracket
          </p>
          {rankedUnlocked && (
            <Chip variant="outline" color="var(--mint)">
              Ranked unlocked
            </Chip>
          )}
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex justify-between gap-2 sv-label text-fg-muted">
              <span>XP</span>
              <span>
                {inLevel} / {xpToNext}
              </span>
            </div>
            <div className="h-2 bg-surface-low overflow-hidden">
              <div className="h-full bg-mint" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>
      </PixelPanel>

      <StatGrid data={data} />

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((badge) => {
            const active = activeSet.has(badge.key)
            return (
              <div key={badge.key} title={badge.description}>
                <PixelPanel
                  tone={active ? 'default' : 'off'}
                  className="h-[100px] flex flex-col items-center justify-center gap-2 text-center"
                >
                  {/* The locked drawing is already a muted two-tone, so no extra dimming here —
                      an opacity-40 on top of it double-dims a state the art already carries. */}
                  <BadgeArt badge={badge.key} state={active ? 'earned' : 'locked'} size={48} />
                  <span className={`sv-label leading-tight ${active ? '' : 'text-fg-muted'}`}>
                    {badge.name}
                  </span>
                  <span className="sr-only"> {badge.description}</span>
                </PixelPanel>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Items</h2>
        <ButtonLink href="/items" variant="secondary" className="justify-between">
          <span>
            {ownedSet.size} of {ITEMS.length} unlocked
          </span>
          <span className="sv-label text-fg-muted">View</span>
        </ButtonLink>
      </section>

      <ShareCardSection cardToken={data.cardToken} />
    </ScreenShell>
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

  const label = cardToken
    ? copied
      ? 'Link copied to clipboard'
      : 'Share my card'
    : 'Create a vault to share your card'

  return (
    <section className="flex flex-col gap-2">
      <h2 className="sv-section-label text-mint">Share</h2>
      <Button
        variant="secondary"
        onClick={share}
        disabled={!url}
        className="justify-start"
      >
        {label}
      </Button>
      {url && <p className="sv-figure font-mono text-fg-faint sv-break">{url}</p>}
      <p className="sv-label text-fg-faint">
        Your card shows your name, level, streak and bracket — never your balance.
      </p>
    </section>
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
      <p className="sv-label text-fg-muted text-right">
        {player.wins}W · {player.losses}L · {player.ties}T
      </p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <PixelPanel className="p-3 flex flex-col gap-1">
      <span className="sv-number-m">{value}</span>
      <span className="sv-label text-fg-muted">{label}</span>
    </PixelPanel>
  )
}
