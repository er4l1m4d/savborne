/**
 * Savborne — Battle screen (`/battle/[id]`)
 *
 * Full-screen (no tab bar) duel view. Polls GET /api/battles/[id] every 3
 * seconds — the same call drives timeout resolution server-side, so a
 * stalled opponent auto-plays Defend without any background worker.
 *
 * States rendered:
 *   pending + creator  → "waiting for your friend" + 24h expiry note
 *   pending + joiner   → accept button (POST join)
 *   active             → HP bars, turn counter, four move buttons, countdown
 *   completed          → "You win!" / "You lost." / "It's a tie." + XP note
 *   abandoned          → expiry message
 *
 * Copy follows spec 9.8 exactly.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { Glyph } from '@/components/Glyphs'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

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
    maxTurns: number
    startingHp: number
  }
  viewer: {
    side: 'a' | 'b'
    address: string
    displayName: string
    hasMovedThisTurn: boolean
    specialAvailable: boolean
    activeItems: ItemKey[]
    ownedInactiveItems: ItemKey[]
    opponentLastMove: string | null
  }
  lastTurn: { turnNumber: number; a: MoveInfo; b: MoveInfo } | null
}

const POLL_MS = 3_000

export default function BattleScreen() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showItems, setShowItems] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Connection lost. Your move will be saved if you reconnect within 60 seconds.',
      )
    }
  }, [id])

  // Initial fetch + poll while the battle can still change.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    fetchState()
    pollRef.current = setInterval(fetchState, POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 1_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      clearInterval(clock)
    }
  }, [fetchState])

  async function submitMove(move: string, itemKey: ItemKey | null = null) {
    if (!state || submitting) return
    setSubmitting(true)
    setShowItems(false)
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

  const secondsLeft = useMemo(() => {
    if (!state?.battle.turnDeadline) return null
    const ms = new Date(state.battle.turnDeadline).getTime() - now
    return Math.max(0, Math.ceil(ms / 1000))
  }, [state, now])

  if (!state) {
    return (
      <ScreenShell variant="pushed" title="Battle" backHref="/battle">
        {error ? (
          <>
            <Banner tone="error">{error}</Banner>
            <BackLink />
          </>
        ) : (
          <p className="sv-body text-fg-muted">Loading battle…</p>
        )}
      </ScreenShell>
    )
  }

  const { battle, viewer, lastTurn } = state
  const myHp = viewer.side === 'a' ? battle.hpA : battle.hpB
  const oppHp = viewer.side === 'a' ? battle.hpB : battle.hpA
  const iAmCreator = viewer.side === 'a'

  if (battle.status === 'abandoned') {
    return (
      <ScreenShell variant="pushed" title="Battle" backHref="/battle">
        <PixelPanel className="p-6 flex flex-col gap-3">
          <h1 className="sv-heading">Challenge expired</h1>
          <p className="sv-body text-fg-muted">
            Your challenge is still waiting. It expires in 24 hours.
          </p>
          <p className="sv-body text-fg-muted">Nobody answered in time — no XP lost.</p>
          <BackLink />
        </PixelPanel>
      </ScreenShell>
    )
  }

  if (battle.status === 'pending') {
    return (
      <ScreenShell variant="pushed" title="Battle" backHref="/battle">
        {iAmCreator ? (
          <PixelPanel className="p-6 flex flex-col gap-3">
            <h1 className="sv-heading">Challenge sent</h1>
            <p className="sv-body text-fg-muted">
              Your challenge is still waiting. It expires in 24 hours.
            </p>
            <p className="sv-label text-fg-faint">Share the code from the Battle tab.</p>
            <BackLink />
          </PixelPanel>
        ) : (
          <PixelPanel className="p-6 flex flex-col gap-3">
            <h1 className="sv-heading">{battle.opponentName} challenges you</h1>
            <p className="sv-body text-fg-muted">
              5 turns. No chance. Winner has more health.
            </p>
            <Button variant="primary" onClick={join} disabled={submitting}>
              {submitting ? 'Joining…' : 'Accept challenge'}
            </Button>
            <BackLink />
          </PixelPanel>
        )}
      </ScreenShell>
    )
  }

  if (battle.status === 'completed') {
    const iWon = battle.winner === viewer.address
    const isTie = battle.winner === null
    return (
      <ScreenShell variant="pushed" title="Battle" backHref="/battle">
        <PixelPanel className="p-6 flex flex-col gap-3">
          <h1
            className="sv-display"
            style={{
              color: isTie ? 'var(--butter)' : iWon ? 'var(--mint)' : 'var(--coral-text)',
            }}
          >
            {isTie ? "It's a tie." : iWon ? 'You win!' : 'You lost.'}
          </h1>
          <p className="sv-body text-fg-muted">
            {isTie
              ? 'Both characters held their ground. Each player gets 15 XP.'
              : iWon
                ? '+30 XP added.'
                : '+10 XP — a loss still teaches.'}
          </p>
          <div className="flex justify-between sv-label text-fg-faint">
            <span>You: {myHp} HP</span>
            <span>
              {battle.opponentName}: {oppHp} HP
            </span>
          </div>
          <BackLink label="Back to battle" />
        </PixelPanel>
      </ScreenShell>
    )
  }

  // ── Active battle ──
  return (
    <ScreenShell
      variant="pushed"
      title="Battle"
      backHref="/battle"
      actions={
        <span className="sv-figure text-butter-text">
          Turn {battle.currentTurn} of {battle.maxTurns}
        </span>
      }
    >
      <span className="sv-section-label text-fg-faint">
        {battle.mode === 'ai' ? 'Unranked. Opponent: Savborne AI.' : `vs ${battle.opponentName}`}
      </span>

      <HpBars
        me={myHp}
        opp={oppHp}
        maxHp={battle.startingHp}
        oppName={battle.opponentName}
        meName={viewer.displayName}
      />

      {viewer.opponentLastMove && (
        <p className="sv-label text-mint">
          ◈ Copper Compass: their last move was <strong>{viewer.opponentLastMove}</strong>.
        </p>
      )}

      {lastTurn && <TurnLog turn={lastTurn} meSide={viewer.side} />}

      {viewer.hasMovedThisTurn ? (
        <PixelPanel className="p-4 text-center flex flex-col gap-1">
          <p className="sv-body text-fg-muted">Waiting for your opponent to choose.</p>
          {secondsLeft !== null && (
            <p className="sv-figure text-fg-faint">{secondsLeft}s</p>
          )}
        </PixelPanel>
      ) : (
        <div className="flex flex-col gap-2">
          <h2 className="sv-subheading">Choose your move</h2>
          <div className="grid grid-cols-2 gap-2">
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
              label="Special Move"
              glyph="special"
              variant="secondary"
              note={viewer.specialAvailable ? undefined : 'cooldown 1'}
              onClick={() => submitMove('special')}
              disabled={submitting || !viewer.specialAvailable}
            />
            <MoveButton
              label="Use item"
              glyph="useItem"
              variant="secondary"
              onClick={() => setShowItems((s) => !s)}
              disabled={submitting || viewer.ownedInactiveItems.length === 0}
            />
          </div>
          {showItems && viewer.ownedInactiveItems.length > 0 && (
            <PixelPanel tone="off" className="p-3 flex flex-col gap-1">
              <p className="sv-section-label text-fg-faint">
                Activate one item (costs your turn, lasts the battle)
              </p>
              {viewer.ownedInactiveItems.map((k) => {
                const it = ITEMS.find((i) => i.key === k)!
                return (
                  <Button
                    key={k}
                    variant="secondary"
                    size="sm"
                    fullWidth
                    className="justify-start"
                    onClick={() => submitMove('item', k)}
                    disabled={submitting}
                  >
                    {it.name}{' '}
                    <span className="sv-label text-fg-faint">— {it.blurb}</span>
                  </Button>
                )
              })}
            </PixelPanel>
          )}
          {secondsLeft !== null && (
            <p className="sv-state text-fg-faint text-center">
              Auto-Defend in {secondsLeft}s
            </p>
          )}
        </div>
      )}

      {error && <Banner tone="error">{error}</Banner>}
    </ScreenShell>
  )
}

// ─── Atoms ─────────────────────────────────────────────────────────────────

function BackLink({ label = 'Back to battle' }: { label?: string }) {
  return (
    <ButtonLink href="/battle" variant="ghost" className="self-start">
      {label}
    </ButtonLink>
  )
}

function HpBars({
  me,
  opp,
  maxHp,
  oppName,
  meName,
}: {
  me: number
  opp: number
  maxHp: number
  oppName: string
  meName: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Hp label={meName} value={me} max={maxHp} self />
      <Hp label={oppName} value={opp} max={maxHp} />
    </div>
  )
}

function Hp({
  label,
  value,
  max,
  self,
}: {
  label: string
  value: number
  max: number
  self?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = pct > 50 ? 'var(--mint)' : pct > 20 ? 'var(--butter)' : 'var(--coral)'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className={`sv-state ${self ? 'text-foreground' : 'text-fg-muted'}`}>
          {label}
        </span>
        <span className="sv-figure text-fg-muted">
          {value} / {max}
        </span>
      </div>
      <div className="vpx-soft h-4 bg-surface-low overflow-hidden">
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function TurnLog({
  turn,
  meSide,
}: {
  turn: { turnNumber: number; a: MoveInfo; b: MoveInfo }
  meSide: 'a' | 'b'
}) {
  const mine = meSide === 'a' ? turn.a : turn.b
  const theirs = meSide === 'a' ? turn.b : turn.a
  if (!mine && !theirs) return null
  return (
    <div className="vpx-soft bg-surface p-3 flex flex-col gap-0.5">
      <span className="sv-state text-fg-faint">Turn {turn.turnNumber} result</span>
      {mine && (
        <span className="sv-label text-fg-muted">
          You used {mine.move}
          {mine.damage ? ` and dealt ${mine.damage}` : '.'}
        </span>
      )}
      {theirs && (
        <span className="sv-label text-fg-muted">
          Opponent used {theirs.move}
          {theirs.damage ? ` and dealt ${theirs.damage}` : '.'}
        </span>
      )}
    </div>
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
  /** Small corner note, e.g. the Special Move cooldown. Keeps the disabled state from reflowing the label. */
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
      {note && (
        <span className="sv-state absolute top-1.5 right-2 opacity-70">{note}</span>
      )}
    </Button>
  )
}
