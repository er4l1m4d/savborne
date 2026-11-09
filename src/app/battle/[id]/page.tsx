/**
 * Savborne - battle screen
 *
 * Polls GET /api/battles/[id] every 3 seconds. The same call drives timeout
 * resolution server-side, so a stalled opponent auto-plays Defend without a
 * background worker.
 *
 * States:
 *   pending + creator   -> redirect to the friend challenge screen
 *   pending + joiner    -> accept the challenge
 *   active              -> arena, move grid, item sheet, wait or offline
 *   completed           -> redirect to /battle/[id]/result
 *   abandoned           -> expiry message
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { BATTLE, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { rivalForBattle } from '@/lib/game/rivals'
import { Glyph } from '@/components/Glyphs'
import { CharacterArt } from '@/components/CharacterArt'
import { RivalArt } from '@/components/RivalArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Chip } from '@/components/ui/Chip'
import { Meter } from '@/components/ui/Meter'
import { Arena } from '@/components/battle/Arena'
import { ItemSheet } from '@/components/battle/ItemSheet'
import { VersusCards } from '@/components/battle/VersusCards'

type MoveInfo = { move: string; itemKey: string | null; damage: number } | null

type State = {
  battle: {
    id: string
    mode: 'ranked' | 'unranked' | 'ai'
    status: 'pending' | 'active' | 'completed' | 'abandoned'
    currentTurn: number
    turnDeadline: string | null
    hpA: number
    hpB: number
    winner: string | null
    winnerName: string | null
    createdAt: string
    opponentAddress: string | null
    opponentName: string
    opponentLevel: number | null
    opponentBracket: string | null
    maxTurns: number
    startingHp: number
  }
  viewer: {
    side: 'a' | 'b'
    address: string
    displayName: string
    level: number
    bracket: string | null
    hasMovedThisTurn: boolean
    specialAvailable: boolean
    activeItems: ItemKey[]
    ownedInactiveItems: ItemKey[]
    ownedItems: ItemKey[]
    currentMove: { move: string; itemKey: ItemKey | null } | null
    opponentLastMove: string | null
  }
  lastTurn: { turnNumber: number; a: MoveInfo; b: MoveInfo } | null
}

const POLL_MS = 3_000

export default function BattleScreen() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [offline, setOffline] = useState(false)
  const [offlineSince, setOfflineSince] = useState<number | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const creatorRedirected = useRef(false)
  const completedRedirected = useRef(false)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/battles/${id}`, { headers: authHeaders() })
      if (res.status === 403 || res.status === 404) {
        setError('You are not part of this battle.')
        return
      }
      if (!res.ok) throw new Error(`${res.status}`)
      setState((await res.json()) as State)
      setError(null)
      setOffline(false)
      setOfflineSince(null)
    } catch {
      setOffline(true)
      setOfflineSince((previous) => previous ?? Date.now())
    }
  }, [id])

  // Initial fetch + poll while the battle can still change.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    void fetchState()
    pollRef.current = setInterval(fetchState, POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 1_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      clearInterval(clock)
    }
  }, [fetchState])

  // A pending creator belongs on the friend challenge screen.
  useEffect(() => {
    if (!state || creatorRedirected.current) return
    if (state.battle.status === 'pending' && state.viewer.side === 'a') {
      creatorRedirected.current = true
      router.replace(`/battle/friend/${id}`)
    }
  }, [state, id, router])

  // A completed battle belongs on the result screen.
  useEffect(() => {
    if (!state || completedRedirected.current) return
    if (state.battle.status === 'completed') {
      completedRedirected.current = true
      router.replace(`/battle/${id}/result`)
    }
  }, [state, id, router])

  async function submitMove(move: string, itemKey: ItemKey | null = null) {
    if (!state || submitting) return
    setSubmitting(true)
    setSheetOpen(false)
    try {
      const res = await fetch(`/api/battles/${id}/move`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ move, itemKey }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit move')
    } finally {
      setSubmitting(false)
    }
  }

  async function join() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/battles/${id}/join`, { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept challenge')
    } finally {
      setSubmitting(false)
    }
  }

  async function reconnect() {
    setReconnecting(true)
    await fetchState()
    setReconnecting(false)
  }

  const secondsLeft = useMemo(() => {
    if (!state?.battle.turnDeadline) return null
    const ms = new Date(state.battle.turnDeadline).getTime() - now
    return Math.max(0, Math.ceil(ms / 1000))
  }, [state, now])

  const graceLeft =
    offlineSince === null
      ? BATTLE.reconnectGraceSeconds
      : Math.max(0, BATTLE.reconnectGraceSeconds - Math.floor((now - offlineSince) / 1_000))

  if (!state) {
    return (
      <ScreenShell variant="pushed" title="Battle" backHref="/battle">
        {error ? (
          <Banner tone="error">{error}</Banner>
        ) : offline ? (
          <Banner tone="error">Connection lost. Retrying...</Banner>
        ) : (
          <p className="sv-body text-fg-muted">Loading battle...</p>
        )}
        {offline && !error && (
          <Button variant="primary" onClick={reconnect} loading={reconnecting}>
            Reconnect
          </Button>
        )}
        <BackLink />
      </ScreenShell>
    )
  }

  const { battle, viewer, lastTurn } = state
  const myHp = viewer.side === 'a' ? battle.hpA : battle.hpB
  const oppHp = viewer.side === 'a' ? battle.hpB : battle.hpA
  const iAmCreator = viewer.side === 'a'
  const modeLabel = battle.mode === 'ranked' ? 'Ranked' : 'Unranked'

  if (battle.status === 'abandoned') {
    return (
      <ScreenShell variant="pushed" title="Battle" backHref="/battle">
        <PixelPanel className="flex flex-col gap-3 p-6">
          <h1 className="sv-heading">Challenge expired</h1>
          <p className="sv-body text-fg-muted">Nobody answered in time. No XP lost.</p>
          <BackLink />
        </PixelPanel>
      </ScreenShell>
    )
  }

  if (battle.status === 'pending') {
    if (iAmCreator) {
      return (
        <ScreenShell variant="pushed" title="Battle" backHref="/battle">
          <p className="sv-body text-fg-muted">Opening challenge...</p>
        </ScreenShell>
      )
    }
    const me = {
      name: viewer.displayName,
      meta: `Level ${viewer.level} · ${viewer.bracket ?? 'Entry'}`,
      art: <CharacterArt bracket={(viewer.bracket as Bracket | null) ?? null} size={76} />,
    }
    const challenger = {
      name: battle.opponentName,
      meta: battle.opponentLevel ? `Level ${battle.opponentLevel}` : 'Challenger',
      art:
        battle.mode === 'ai' ? (
          <RivalArt rival={rivalForBattle(id)} size={76} />
        ) : (
          <CharacterArt bracket={(battle.opponentBracket as Bracket | null) ?? null} size={76} />
        ),
    }
    return (
      <ScreenShell
        variant="pushed"
        backHref="/battle"
        actions={<Chip variant="outline">Friend · Unranked</Chip>}
      >
        <div className="flex flex-col gap-2">
          <h1 className="sv-heading sv-break">{battle.opponentName} challenges you</h1>
          <p className="sv-body text-fg-muted">5 turns. No chance. Winner has more health.</p>
        </div>
        <VersusCards me={me} opponent={challenger} height={230} />
        {error && <Banner tone="error">{error}</Banner>}
        <Button variant="primary" onClick={join} loading={submitting} disabled={submitting}>
          Accept challenge
        </Button>
        <BackLink />
      </ScreenShell>
    )
  }

  if (battle.status === 'completed') {
    return (
      <ScreenShell variant="pushed" title="Battle" backHref="/battle">
        <p className="sv-body text-fg-muted">Opening result...</p>
      </ScreenShell>
    )
  }

  const opponentArt =
    battle.mode === 'ai' ? (
      <RivalArt rival={rivalForBattle(id)} size={96} />
    ) : (
      <CharacterArt bracket={(battle.opponentBracket as Bracket | null) ?? null} size={96} />
    )
  const myArt = <CharacterArt bracket={(viewer.bracket as Bracket | null) ?? null} size={112} />
  const lockedItems = ITEMS.filter((item) => !item.isBadge && !viewer.ownedItems.includes(item.key))
    .map((item) => item.key)
  const meStatus = offline
    ? 'offline'
    : viewer.hasMovedThisTurn
      ? 'acted'
      : 'your-move'

  const mine = lastTurn ? (viewer.side === 'a' ? lastTurn.a : lastTurn.b) : null
  const theirs = lastTurn ? (viewer.side === 'a' ? lastTurn.b : lastTurn.a) : null

  return (
    <ScreenShell
      variant="pushed"
      title={`Turn ${battle.currentTurn} of ${battle.maxTurns}`}
      backHref="/battle"
      backLabel="Leave battle"
    >
      <span className="sv-label text-fg-muted">
        {modeLabel}. Opponent: {battle.opponentName}.
      </span>

      <Arena
        me={{
          name: viewer.displayName,
          level: viewer.level,
          hp: myHp,
          maxHp: battle.startingHp,
          art: myArt,
          status: meStatus,
        }}
        opponent={{
          name: battle.opponentName,
          level: battle.opponentLevel,
          hp: oppHp,
          maxHp: battle.startingHp,
          art: opponentArt,
          status: offline ? 'none' : viewer.hasMovedThisTurn ? 'theirs' : 'none',
        }}
        dimmed={offline}
      />

      {viewer.opponentLastMove && (
        <p className="sv-label text-mint">
          ◈ Copper Compass: their last move was <strong>{viewer.opponentLastMove}</strong>.
        </p>
      )}

      {!offline && lastTurn && (mine || theirs) && (
        <p className="sv-label text-fg-muted">
          Turn {lastTurn.turnNumber}: you used {mine?.move ?? '—'}
          {mine?.damage ? ` (${mine.damage} dmg)` : ''} · they used {theirs?.move ?? '—'}
          {theirs?.damage ? ` (${theirs.damage} dmg)` : ''}.
        </p>
      )}

      {offline ? (
        <PixelPanel tone="coral" className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center gap-2.5 text-coral-text">
            <Glyph name="alert" size={24} />
            <span className="sv-label">Offline</span>
          </div>
          <p className="sv-subheading">
            Connection lost. Your move will be saved if you reconnect within 60 seconds.
          </p>
          <div className="flex items-center gap-3">
            <Meter
              value={graceLeft}
              max={BATTLE.reconnectGraceSeconds}
              tone="coral"
              label="Reconnect grace"
              className="flex-1"
            />
            <span className="sv-figure text-fg-muted">
              {Math.floor(graceLeft / 60)}:{String(graceLeft % 60).padStart(2, '0')}
            </span>
          </div>
          <p className="sv-label text-fg-muted">
            {graceLeft > 0
              ? 'Until you reconnect, your next move defaults to Defend.'
              : 'Reconnect to keep playing. Your next move may already have defaulted to Defend.'}
          </p>
          <Button variant="primary" onClick={reconnect} loading={reconnecting}>
            Reconnect
          </Button>
        </PixelPanel>
      ) : viewer.hasMovedThisTurn ? (
        <PixelPanel tone="mint" className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="sv-label text-fg-muted">Your move is locked in</span>
            {viewer.currentMove && (
              <Chip variant="outline" color="var(--coral-text)">
                {capitalise(viewer.currentMove.move)}
              </Chip>
            )}
          </div>
          <p className="sv-subheading">Waiting for your opponent to choose.</p>
          <div className="flex items-center gap-3">
            <Meter
              value={secondsLeft ?? 0}
              max={BATTLE.turnTimerSeconds}
              label="Turn time left"
              className="flex-1"
            />
            <span className="sv-figure text-fg-muted">
              0:{String(secondsLeft ?? 0).padStart(2, '0')} left
            </span>
          </div>
        </PixelPanel>
      ) : (
        <div className="flex flex-col gap-2">
          <h2 className="sv-subheading">Choose your move</h2>
          <div className="grid grid-cols-2 gap-3.5">
            <MoveButton
              label="Attack"
              glyph="attack"
              variant="primary"
              onClick={() => submitMove('attack')}
              disabled={submitting}
            />
            <MoveButton
              label="Defend"
              glyph="defend"
              variant="secondary"
              onClick={() => submitMove('defend')}
              disabled={submitting}
            />
            <MoveButton
              label="Use item"
              glyph="useItem"
              variant="secondary"
              onClick={() => setSheetOpen(true)}
              disabled={submitting || viewer.ownedInactiveItems.length === 0}
            />
            <MoveButton
              label="Special Move"
              glyph="special"
              variant="secondary"
              note={viewer.specialAvailable ? undefined : '(cooldown: 1 turn)'}
              onClick={() => submitMove('special')}
              disabled={submitting || !viewer.specialAvailable}
            />
          </div>
          {secondsLeft !== null && (
            <p className="sv-label text-center text-fg-faint">
              Auto-Defend in {secondsLeft}s
            </p>
          )}
        </div>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <ItemSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        available={viewer.ownedInactiveItems}
        used={viewer.activeItems}
        locked={lockedItems}
        onUse={(key) => submitMove('item', key)}
        busy={submitting}
      />
    </ScreenShell>
  )
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function BackLink({ label = 'Back to Battle' }: { label?: string }) {
  return (
    <ButtonLink href="/battle" variant="ghost" className="self-start">
      {label}
    </ButtonLink>
  )
}

function MoveButton({
  label,
  note,
  glyph,
  onClick,
  disabled,
  variant,
}: {
  label: string
  note?: string
  glyph: 'attack' | 'defend' | 'special' | 'useItem'
  onClick: () => void
  disabled: boolean
  variant: 'primary' | 'secondary'
}) {
  return (
    <Button
      variant={variant}
      size="move"
      onClick={onClick}
      disabled={disabled}
      className="relative"
    >
      <Glyph name={glyph} size={24} />
      <span>{label}</span>
      {note && <span className="sv-label opacity-70">{note}</span>}
    </Button>
  )
}
