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
import { BadgeArt, Glyph } from '@/components/Glyphs'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Row } from '@/components/ui/Row'
import { Chip } from '@/components/ui/Chip'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

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

  const ownedSet = new Set(data.ownedItems)
  const activeSet = new Set(data.activeBadges)
  const b = data.player.bracket

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
      <section className="flex flex-col gap-1">
        <h2 className="sv-heading sv-break">{data.player.displayName}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="sv-label text-fg-muted">Level {data.player.level}</span>
          {b && (
            <Chip variant="outline" color={BRACKETS[b].color}>
              {BRACKETS[b].label}
            </Chip>
          )}
        </div>
      </section>

      <StatGrid data={data} />

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((badge) => {
            const active = activeSet.has(badge.key)
            return (
              <div
                key={badge.key}
                className={`vpx-soft p-2 flex flex-col items-center gap-1 text-center ${
                  active ? 'bg-surface-hi' : 'bg-surface'
                }`}
                title={badge.description}
              >
                {/* The locked drawing is already a muted two-tone, so no extra dimming here —
                    an opacity-40 on top of it double-dims a state the art already carries. */}
                <BadgeArt badge={badge.key} state={active ? 'earned' : 'locked'} size={32} />
                <span className="sv-label leading-tight">{badge.name}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Inventory</h2>
        <PixelPanel className="px-4 py-0">
          {ITEMS.map((item, index) => {
            const unlocked = ownedSet.has(item.key)
            return (
              <Row
                key={item.key}
                divider={index < ITEMS.length - 1}
                className={unlocked ? undefined : 'bg-surface-low opacity-60'}
                leading={
                  <span
                    className="shrink-0 inline-block w-2 h-2"
                    style={{
                      background: unlocked
                        ? BRACKETS[item.bracket].color
                        : 'var(--bevel-soft)',
                    }}
                    aria-hidden
                  />
                }
              >
                <div className="flex flex-col gap-1 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`sv-label ${unlocked ? 'text-foreground' : 'text-fg-muted'}`}>
                      {item.name}
                    </span>
                    <Chip variant="outline" color={BRACKETS[item.bracket].color}>
                      {BRACKETS[item.bracket].label}
                    </Chip>
                  </div>
                  <p className="sv-label text-fg-muted">
                    {unlocked ? item.blurb : `Locked: reach ${item.bracket} to unlock.`}
                  </p>
                  {unlocked && !item.isBadge && (
                    <p className="sv-label text-mint">Active in battles.</p>
                  )}
                </div>
              </Row>
            )
          })}
        </PixelPanel>
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
    <div className="vpx-soft bg-surface p-3 flex flex-col gap-1">
      <span className="sv-number-m">{value}</span>
      <span className="sv-label text-fg-muted">{label}</span>
    </div>
  )
}
