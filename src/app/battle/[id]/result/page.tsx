/**
 * Savborne - battle result
 *
 * Win, loss and tie share one screen. The result uses ResultPanel, the same
 * arena as the battle, the current profile rating/record, the First Blade
 * unlock when this was the first win, and the items used in the battle.
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { type Bracket } from '@/lib/constants'
import {
  battleOutcome,
  battleXpForOutcome,
  resultCopy,
  resultSpriteSizes,
  type BattleResult,
} from '@/lib/battle-ui'
import { rivalForBattle } from '@/lib/game/rivals'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { CharacterArt } from '@/components/CharacterArt'
import { RivalArt } from '@/components/RivalArt'
import { BadgeArt } from '@/components/Glyphs'
import { ItemArt } from '@/components/ItemArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { ResultPanel } from '@/components/ui/ResultPanel'
import { ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Arena } from '@/components/battle/Arena'

type ResultState = {
  battle: {
    id: string
    mode: 'ranked' | 'unranked' | 'ai'
    status: 'pending' | 'active' | 'completed' | 'abandoned'
    hpA: number
    hpB: number
    winner: string | null
    opponentName: string
    opponentLevel: number | null
    opponentBracket: string | null
    startingHp: number
  }
  viewer: {
    side: 'a' | 'b'
    address: string
    displayName: string
    level: number
    bracket: string | null
    activeItems: ItemKey[]
  }
}

type Profile = {
  player: { rating: number; wins: number; losses: number; ties: number }
  activeBadges: string[]
}

const OUTCOME_LABEL: Record<BattleResult, string> = {
  win: 'Battle win',
  loss: 'Battle loss',
  tie: 'Battle tie',
}

export default function BattleResultPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [state, setState] = useState<ResultState | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [battleRes, profileRes] = await Promise.all([
          fetch(`/api/battles/${id}`, { headers: authHeaders() }),
          fetch('/api/profile', { headers: authHeaders() }).catch(() => null),
        ])
        if (cancelled) return
        if (battleRes.status === 403 || battleRes.status === 404) {
          setError('You are not part of this battle.')
          return
        }
        if (!battleRes.ok) throw new Error(`Failed (${battleRes.status})`)
        const battle = (await battleRes.json()) as ResultState
        if (battle.battle.status !== 'completed') {
          router.replace(`/battle/${id}`)
          return
        }
        setState(battle)
        if (profileRes?.ok) setProfile((await profileRes.json()) as Profile)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load the result')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, router])

  if (error) {
    return (
      <ScreenShell variant="pushed">
        <Banner tone="error">{error}</Banner>
        <ButtonLink href="/battle" variant="secondary">
          Back to Battle
        </ButtonLink>
      </ScreenShell>
    )
  }

  if (!state) {
    return (
      <ScreenShell variant="pushed">
        <p className="sv-body text-fg-muted">Loading result...</p>
      </ScreenShell>
    )
  }

  const { battle, viewer } = state
  const outcome = battleOutcome(battle.winner, viewer.address)
  const copy = resultCopy(outcome)
  const xp = battleXpForOutcome(outcome)
  const spriteSizes = resultSpriteSizes(outcome)
  const myHp = viewer.side === 'a' ? battle.hpA : battle.hpB
  const oppHp = viewer.side === 'a' ? battle.hpB : battle.hpA
  const modeLabel =
    battle.mode === 'ranked'
      ? 'Ranked'
      : battle.mode === 'unranked'
        ? 'Friend · Unranked'
        : 'Unranked'

  const opponentArt =
    battle.mode === 'ai' ? (
      <RivalArt rival={rivalForBattle(id)} size={spriteSizes.opponent} />
    ) : (
      <CharacterArt
        bracket={(battle.opponentBracket as Bracket | null) ?? null}
        size={spriteSizes.opponent}
      />
    )

  const firstBlade =
    outcome === 'win' &&
    profile?.activeBadges.includes('first_blade') === true &&
    profile.player.wins === 1

  const itemsUsed = viewer.activeItems
    .map((key) => ITEMS.find((item) => item.key === key))
    .filter((item): item is (typeof ITEMS)[number] => !!item)

  const extras = []
  if (firstBlade) {
    extras.push(
      <PixelPanel key="first-blade" className="flex items-center gap-3.5 px-4 py-3.5">
        <BadgeArt badge="first_blade" state="earned" size={32} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="sv-label">First Blade earned</span>
          <span className="sv-label text-fg-muted">Your first battle win</span>
        </div>
      </PixelPanel>,
    )
  }
  if (itemsUsed.length > 0) {
    extras.push(
      <PixelPanel key="items-used" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="sv-section-label text-fg-faint">Items used</span>
        {itemsUsed.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5">
            <ItemArt item={item.key} size={24} />
            <span className="sv-label">{item.name}</span>
          </span>
        ))}
      </PixelPanel>,
    )
  }

  return (
    <ScreenShell variant="pushed">
      <div className="sv-pop flex flex-col gap-6">
        <span className="sv-label text-center text-fg-muted">
          {modeLabel} · vs {battle.opponentName}
        </span>

        <ResultPanel
          title={copy.title}
          tone={copy.tone}
          header={
            <Arena
              me={{
                name: viewer.displayName,
                level: viewer.level,
                hp: myHp,
                maxHp: battle.startingHp,
                art: (
                  <CharacterArt
                    bracket={(viewer.bracket as Bracket | null) ?? null}
                    size={spriteSizes.me}
                  />
                ),
                status: 'none',
                opacity: outcome === 'loss' ? 0.55 : 1,
              }}
              opponent={{
                name: battle.opponentName,
                level: battle.opponentLevel,
                hp: oppHp,
                maxHp: battle.startingHp,
                art: opponentArt,
                status: 'none',
                opacity: outcome === 'win' ? 0.55 : 1,
              }}
              variant="result"
              tone={outcome === 'win' ? 'mint' : outcome === 'loss' ? 'coral' : 'default'}
            />
          }
          tiles={[
            { label: OUTCOME_LABEL[outcome], value: `+${xp} XP` },
            battle.mode === 'ranked'
              ? {
                  label: 'Ranked rating',
                  value: profile ? String(profile.player.rating) : '—',
                }
              : {
                  label: 'Record',
                  value: profile
                    ? `${profile.player.wins}-${profile.player.losses}-${profile.player.ties}`
                    : '—',
                },
          ]}
          unlocks={extras.length > 0 ? extras : undefined}
          actions={
            <>
              <ButtonLink href="/battle" variant="primary">
                Back to Battle
              </ButtonLink>
              <ButtonLink href="/" variant="secondary">
                Go to Home
              </ButtonLink>
            </>
          }
        />
      </div>
    </ScreenShell>
  )
}
