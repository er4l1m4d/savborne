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
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Row } from '@/components/ui/Row'
import { Chip } from '@/components/ui/Chip'
import { Tabs } from '@/components/ui/Tabs'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'

type RankRow = {
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
  verifiedSaver: boolean
}

export default function LeaderboardPage() {
  const [board, setBoard] = useState<'ranked' | 'unranked'>('ranked')
  const [friends, setFriends] = useState(false)
  const [rows, setRows] = useState<RankRow[] | null>(null)
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
      const json = (await res.json()) as { rows: RankRow[]; total: number }
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
    <ScreenShell
      variant="tab"
      title="Ranks"
      actions={
        <Button
          variant="secondary"
          size="sm"
          fullWidth={false}
          aria-pressed={friends}
          onClick={() => setFriends((f) => !f)}
        >
          Friends {friends ? 'on' : 'off'}
        </Button>
      }
    >
      <Tabs
        ariaLabel="Leaderboard"
        value={board}
        onChange={(v) => setBoard(v as 'ranked' | 'unranked')}
        items={[
          { value: 'ranked', label: 'Ranked' },
          { value: 'unranked', label: 'Unranked' },
        ]}
      />

      {loading && <LoadingState />}
      {error && <Banner tone="error">{error}</Banner>}

      {!loading && !error && rows && (
        <>
          {rows.length === 0 ? (
            <PixelPanel className="p-6 text-center flex flex-col gap-2">
              <p className="sv-body text-fg-muted">Nobody on this board yet.</p>
              <p className="sv-label text-fg-faint">
                {board === 'ranked'
                  ? 'Ranked play opens at Level 3 with 5 check-ins.'
                  : 'Check in and battle — scores build from real play.'}
              </p>
            </PixelPanel>
          ) : (
            <PixelPanel className="px-4 py-0">
              {rows.map((r, i) => (
                <Row
                  key={`${r.rank}-${r.displayName}`}
                  minHeight={56}
                  divider={i < rows.length - 1}
                  className={r.isMe ? 'bg-surface-hi' : undefined}
                  leading={
                    <span
                      className={`sv-figure w-8 text-center shrink-0 ${
                        r.rank === 1
                          ? 'text-gold'
                          : r.rank === 2
                            ? 'text-silver'
                            : r.rank === 3
                              ? 'text-bronze'
                              : 'text-fg-faint'
                      }`}
                    >
                      {r.rank}
                    </span>
                  }
                  trailing={
                    <span className="sv-figure text-butter-text shrink-0">{r.score}</span>
                  }
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="sv-label">
                        {r.displayName}
                        {r.isMe && <span className="sv-label text-fg-faint"> (you)</span>}
                      </span>
                      {r.verifiedSaver && (
                        <span
                          title="Verified saver — funds held in their own vault"
                          aria-label="Verified saver — funds held in their own vault"
                          className="text-mint shrink-0 text-sm leading-none"
                        >
                          ⟡
                        </span>
                      )}
                      {r.bracket && (
                        <Chip
                          variant="outline"
                          color={BRACKETS[r.bracket as Bracket]?.color}
                        >
                          {BRACKETS[r.bracket as Bracket]?.label}
                        </Chip>
                      )}
                    </div>
                    <p className="sv-label text-fg-faint">
                      Lvl {r.level} · {r.wins}W
                      {board === 'unranked' && r.amountScore !== null
                        ? ` · growth ${r.amountScore} · streak ${r.consistencyScore}`
                        : ` · streak ${r.streak}d`}
                    </p>
                  </div>
                </Row>
              ))}
            </PixelPanel>
          )}
          <p className="sv-label text-fg-faint text-center">
            {total} player{total === 1 ? '' : 's'} · balances and addresses are never shown
          </p>
          <p className="sv-label text-fg-faint text-center">
            ⟡ marks a verified saver — funds in their own vault
          </p>
        </>
      )}
    </ScreenShell>
  )
}
