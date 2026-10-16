/**
 * Savborne — Leaderboards
 *
 * Ranked (Elo) and Unranked (combined savings score) boards with a friends
 * filter, per spec 10.4. Display names only; the caller's row is highlighted.
 * Pulls /api/leaderboards on tab change.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { authHeaders } from '@/lib/session'
import { BRACKETS, type Bracket } from '@/lib/constants'

type Row = {
  rank: number
  displayName: string
  level: number
  bracket: string | null
  score: number
  wins: number
  amountScore: number | null
  consistencyScore: number | null
  streak: number
  isMe: boolean
}

export default function LeaderboardPage() {
  const [board, setBoard] = useState<'ranked' | 'unranked'>('ranked')
  const [friends, setFriends] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaderboards?board=${board}&friends=${friends ? 1 : 0}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = (await res.json()) as { rows: Row[]; total: number }
      setRows(json.rows)
      setTotal(json.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [board, friends])

  useEffect(() => {
    load()
  }, [load])

  return (
    <main className="p-(--gut) max-w-105 mx-auto w-full flex flex-col gap-4">
      <header className="flex items-baseline justify-between mt-4">
        <h1 className="text-3xl leading-none" style={{ fontFamily: 'var(--font-silkscreen)' }}>
          Ranks
        </h1>
        <button
          onClick={() => setFriends((f) => !f)}
          aria-pressed={friends}
          className={`vpx-soft px-3 h-8 text-xs font-bold uppercase tracking-widest ${
            friends ? 'bg-mint-tint text-mint' : 'bg-surface text-fg-muted'
          }`}
        >
          Friends {friends ? 'on' : 'off'}
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <BoardTab active={board === 'ranked'} onClick={() => setBoard('ranked')} label="Ranked" hint="Elo & wins" />
        <BoardTab
          active={board === 'unranked'}
          onClick={() => setBoard('unranked')}
          label="Unranked"
          hint="Savings score"
        />
      </div>

      {loading && <p className="text-sm text-fg-muted py-6 text-center">Loading…</p>}
      {error && <div className="vpx bg-coral-tint p-3 text-sm text-coral-text">{error}</div>}

      {!loading && !error && rows && (
        <>
          {rows.length === 0 ? (
            <div className="vpx-soft bg-surface p-6 text-center flex flex-col gap-2">
              <p className="text-sm text-fg-muted">Nobody on this board yet.</p>
              <p className="text-xs text-fg-faint">
                {board === 'ranked'
                  ? 'Ranked play opens at Level 3 with 5 check-ins.'
                  : 'Check in and battle — scores build from real play.'}
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {rows.map((r) => (
                <li
                  key={`${r.rank}-${r.displayName}`}
                  className={`vpx-soft p-2.5 flex items-center gap-3 ${
                    r.isMe ? 'bg-surface-hi' : 'bg-surface'
                  }`}
                >
                  <span
                    className={`num w-8 text-center font-bold shrink-0 ${
                      r.rank === 1 ? 'text-gold' : r.rank === 2 ? 'text-silver' : r.rank === 3 ? 'text-bronze' : 'text-fg-faint'
                    }`}
                  >
                    {r.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate">
                        {r.displayName}
                        {r.isMe && <span className="text-fg-faint"> (you)</span>}
                      </span>
                      {r.bracket && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider shrink-0"
                          style={{ color: BRACKETS[r.bracket as Bracket]?.color }}
                        >
                          {BRACKETS[r.bracket as Bracket]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-fg-faint">
                      Lvl {r.level} · {r.wins}W
                      {board === 'unranked' && r.amountScore !== null
                        ? ` · growth ${r.amountScore} · streak ${r.consistencyScore}`
                        : ` · streak ${r.streak}d`}
                    </p>
                  </div>
                  <span className="num text-lg font-bold text-butter-text shrink-0">{r.score}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-[10px] text-fg-faint text-center">
            {total} player{total === 1 ? '' : 's'} · balances and addresses are never shown
          </p>
        </>
      )}
    </main>
  )
}

function BoardTab({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  label: string
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      className={`vpx-soft p-2.5 text-left flex flex-col gap-0.5 ${
        active ? 'bg-surface-hi' : 'bg-surface opacity-70'
      }`}
    >
      <span className={`text-sm font-bold ${active ? 'text-mint' : 'text-fg-muted'}`}>{label}</span>
      <span className="text-[10px] uppercase tracking-widest text-fg-faint">{hint}</span>
    </button>
  )
}
