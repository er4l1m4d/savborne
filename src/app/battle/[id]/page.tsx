/**
 * Savborne — Battle screen (`/battle/[id]`)
 *
 * Full-screen (no tab bar) duel view. Polls GET /api/battles/[id] every 3
 * seconds — the same call drives timeout resolution server-side, so a
 * stalled opponent auto-plays Defend without any background worker.
 *
 * States rendered:
 *   pending + creator  → "waiting for your friend" + share code + 24h expiry note
 *   pending + joiner   → accept button (POST join)
 *   active             → HP bars, turn counter, four move buttons, countdown
 *   completed          → "You win!" / "You lost." / "It's a tie." + XP note
 *   abandoned          → expiry message
 *
 * Copy follows spec 9.8 exactly.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { ITEMS, type ItemKey } from '@/lib/game/items'

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
  const router = useRouter()
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
      setError(err instanceof Error ? err.message : 'Connection lost. Your move will be saved if you reconnect within 60 seconds.')
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

  const isOver = state?.battle.status === 'completed' || state?.battle.status === 'abandoned'

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
      <Shell>
        {error ? (
          <Panel tone="error">
            <p>{error}</p>
            <BackLink />
          </Panel>
        ) : (
          <p className="text-fg-muted text-sm">Loading battle…</p>
        )}
      </Shell>
    )
  }

  const { battle, viewer, lastTurn } = state
  const myHp = viewer.side === 'a' ? battle.hpA : battle.hpB
  const oppHp = viewer.side === 'a' ? battle.hpB : battle.hpA
  const iAmCreator = viewer.side === 'a'

  // ── Terminal states ──
  if (battle.status === 'abandoned') {
    return (
      <Shell>
        <Panel>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-silkscreen)' }}>
            Challenge expired
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Your challenge is still waiting. It expires in 24 hours.
          </p>
          <p className="text-sm text-fg-muted">Nobody answered in time — no XP lost.</p>
          <BackLink />
        </Panel>
      </Shell>
    )
  }

  if (battle.status === 'pending') {
    return (
      <Shell>
        {iAmCreator ? (
          <Panel>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-silkscreen)' }}>
              Challenge sent
            </h1>
            <p className="text-sm text-fg-muted mt-2">
              Your challenge is still waiting. It expires in 24 hours.
            </p>
            <p className="text-xs text-fg-faint">Share the code from the Battle tab.</p>
            <BackLink />
          </Panel>
        ) : (
          <Panel>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-silkscreen)' }}>
              {battle.opponentName} challenges you
            </h1>
            <p className="text-sm text-fg-muted mt-2">5 turns. No chance. Winner has more health.</p>
            <button
              onClick={join}
              disabled={submitting}
              className="vpx bg-mint text-[#0E1D19] py-3 px-4 font-bold mt-4 active:translate-y-[2px] disabled:opacity-40"
              style={{ boxShadow: '0 3px 0 var(--bevel-shadow)' }}
            >
              {submitting ? 'Joining…' : 'Accept challenge'}
            </button>
          </Panel>
        )}
      </Shell>
    )
  }

  if (battle.status === 'completed') {
    const iWon = battle.winner === viewer.address
    const isTie = battle.winner === null
    return (
      <Shell>
        <Panel>
          <h1
            className="text-3xl font-bold"
            style={{
              fontFamily: 'var(--font-silkscreen)',
              color: isTie ? 'var(--butter)' : iWon ? 'var(--mint)' : 'var(--coral-text)',
            }}
          >
            {isTie ? "It's a tie." : iWon ? 'You win!' : 'You lost.'}
          </h1>
          <p className="text-sm text-fg-muted mt-3">
            {isTie
              ? 'Both characters held their ground. Each player gets 15 XP.'
              : iWon
                ? '+30 XP added.'
                : '+10 XP — a loss still teaches.'}
          </p>
          <div className="flex justify-between text-xs text-fg-faint mt-4 num">
            <span>
              You: {myHp} HP
            </span>
            <span>
              {battle.opponentName}: {oppHp} HP
            </span>
          </div>
          <BackLink label="Back to battle" />
        </Panel>
      </Shell>
    )
  }

  // ── Active battle ──
  return (
    <Shell>
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-4 p-[var(--gut)]">
        <header className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-widest text-fg-faint">
            {battle.mode === 'ai' ? 'Unranked. Opponent: Savborne AI.' : `vs ${battle.opponentName}`}
          </span>
          <span className="num text-sm font-bold text-butter-text">
            Turn {battle.currentTurn} of {battle.maxTurns}
          </span>
        </header>

        <HpBars me={myHp} opp={oppHp} maxHp={battle.startingHp} oppName={battle.opponentName} meName={viewer.displayName} />

        {viewer.opponentLastMove && (
          <p className="text-[11px] text-mint">
            ◈ Copper Compass: their last move was <strong>{viewer.opponentLastMove}</strong>.
          </p>
        )}

        {lastTurn && (
          <TurnLog turn={lastTurn} meSide={viewer.side} />
        )}

        {viewer.hasMovedThisTurn ? (
          <div className="vpx-soft bg-surface p-4 text-center">
            <p className="text-sm text-fg-muted">Waiting for your opponent to choose.</p>
            {secondsLeft !== null && (
              <p className="text-[11px] text-fg-faint num mt-1">{secondsLeft}s</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-silkscreen)' }}>
              Choose your move
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <MoveButton label="Attack" onClick={() => submitMove('attack')} disabled={submitting} accent="var(--coral)" />
              <MoveButton label="Defend" onClick={() => submitMove('defend')} disabled={submitting} accent="var(--silver)" />
              <MoveButton
                label={viewer.specialAvailable ? 'Special Move' : 'Special Move (cooldown: 1 turn)'}
                onClick={() => submitMove('special')}
                disabled={submitting || !viewer.specialAvailable}
                accent="var(--butter)"
              />
              <MoveButton
                label="Use item"
                onClick={() => setShowItems((s) => !s)}
                disabled={submitting || viewer.ownedInactiveItems.length === 0}
                accent="var(--mint)"
              />
            </div>
            {showItems && viewer.ownedInactiveItems.length > 0 && (
              <div className="vpx-soft bg-surface-low p-3 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-widest text-fg-faint font-bold">
                  Activate one item (costs your turn, lasts the battle)
                </p>
                {viewer.ownedInactiveItems.map((k) => {
                  const it = ITEMS.find((i) => i.key === k)!
                  return (
                    <button
                      key={k}
                      onClick={() => submitMove('item', k)}
                      disabled={submitting}
                      className="text-left text-sm py-1.5 px-2 hover:bg-surface-hi disabled:opacity-50"
                    >
                      {it.name} <span className="text-fg-faint text-xs">— {it.blurb}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {secondsLeft !== null && (
              <p className="text-[11px] text-fg-faint num text-center">
                Auto-Defend in {secondsLeft}s
              </p>
            )}
          </div>
        )}

        {error && <div className="vpx bg-coral-tint p-3 text-sm text-coral-text">{error}</div>}
      </div>
    </Shell>
  )
}

// ─── Atoms ─────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh flex items-start justify-center bg-background">{children}</main>
}

function Panel({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div
      className={`vpx p-6 max-w-[360px] w-full m-[var(--gut)] ${
        tone === 'error' ? 'bg-coral-tint text-coral-text' : 'bg-surface text-foreground'
      }`}
    >
      {children}
    </div>
  )
}

function BackLink({ label = 'Back to battle' }: { label?: string }) {
  return (
    <Link href="/battle" className="text-sm text-mint underline underline-offset-4 mt-4 self-start">
      {label}
    </Link>
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

function Hp({ label, value, max, self }: { label: string; value: number; max: number; self?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = pct > 50 ? 'var(--mint)' : pct > 20 ? 'var(--butter)' : 'var(--coral)'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px] uppercase tracking-widest">
        <span className={self ? 'text-foreground font-bold' : 'text-fg-muted'}>{label}</span>
        <span className="num text-fg-muted">{value} / {max}</span>
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
    <div className="vpx-soft bg-surface p-3 text-xs text-fg-muted flex flex-col gap-0.5">
      <span className="font-bold text-fg-faint uppercase tracking-widest text-[10px]">
        Turn {turn.turnNumber} result
      </span>
      {mine && <span>You used {mine.move}{mine.damage ? ` and dealt ${mine.damage}` : '.'}</span>}
      {theirs && <span>Opponent used {theirs.move}{theirs.damage ? ` and dealt ${theirs.damage}` : '.'}</span>}
    </div>
  )
}

function MoveButton({
  label,
  onClick,
  disabled,
  accent,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  accent: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="vpx-soft bg-surface py-3 px-2 text-sm font-bold hover:bg-surface-hi active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: accent }}
    >
      {label}
    </button>
  )
}
