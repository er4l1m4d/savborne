/**
 * Savborne — Ranks
 *
 * The handoff's leaderboard: Ranked / Unranked tabs, Everyone / Friends filter
 * chips, one grouped panel of 56px rows and the caller's 60px mint-bordered row.
 * The caller is pinned below the list when outside the top 50, using the API's
 * additive `you` row. Ranking rules and the friends definition are unchanged;
 * `/api/leaderboards` still returns the top 50 and only display names leave the
 * server.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { BRACKETS, type Bracket } from '@/lib/constants'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Row } from '@/components/ui/Row'
import { Chip } from '@/components/ui/Chip'
import { Tabs } from '@/components/ui/Tabs'
import { FilterBar } from '@/components/ui/FilterBar'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { RankCrown } from '@/components/RankCrown'
import {
  boardFooter,
  footerLegend,
  isFriendsEmpty,
  rankTone,
  shouldPinYou,
  type Board,
} from '@/lib/ranks-ui'

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

type BoardResponse = {
  rows: RankRow[]
  total: number
  you?: RankRow | null
}

const LOAD_ERROR = "Couldn't load ranks."

export default function LeaderboardPage() {
  const router = useRouter()
  const [board, setBoard] = useState<Board>('ranked')
  const [friends, setFriends] = useState(false)
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [you, setYou] = useState<RankRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/leaderboards?board=${board}&friends=${friends ? 1 : 0}`,
          { headers: authHeaders() },
        )
        if (res.status === 401) {
          router.replace('/setup')
          return
        }
        if (!res.ok) throw new Error(LOAD_ERROR)
        const json = (await res.json()) as BoardResponse
        if (!cancelled) {
          setRows(json.rows)
          setTotal(json.total)
          setYou(json.you ?? null)
        }
      } catch {
        if (!cancelled) setError(LOAD_ERROR)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [board, friends, reload, router])

  const empty = rows !== null && rows.length === 0
  const friendsEmpty = rows !== null && friends && isFriendsEmpty(rows)
  const pinned = rows !== null && shouldPinYou(rows, you)
  const showFooter = rows !== null && !empty && !friendsEmpty
  const anyVerified =
    rows?.some((row) => row.verifiedSaver) === true ||
    (pinned && you?.verifiedSaver === true)

  return (
    <ScreenShell variant="tab" title="Ranks" bodyClassName="gap-3.5">
      <Tabs
        ariaLabel="Leaderboard"
        value={board}
        onChange={(value) => setBoard(value as Board)}
        items={[
          { value: 'ranked', label: 'Ranked' },
          { value: 'unranked', label: 'Unranked' },
        ]}
      />

      <div className="flex min-h-11 items-center justify-end">
        <FilterBar
          ariaLabel="Board filter"
          value={friends ? 'friends' : 'everyone'}
          onChange={(value) => setFriends(value === 'friends')}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'friends', label: 'Friends' },
          ]}
        />
      </div>

      {loading && <LoadingState />}

      {!loading && error && (
        <>
          <Banner tone="error">{error}</Banner>
          <Button
            variant="secondary"
            fullWidth={false}
            className="self-start"
            onClick={() => setReload((n) => n + 1)}
          >
            Try again
          </Button>
        </>
      )}

      {!loading && !error && rows && (
        friendsEmpty ? (
          <FriendsEmptyPanel />
        ) : empty ? (
          <EmptyPanel board={board} />
        ) : (
          <>
            <PixelPanel className="px-3.5 py-0.5">
              {rows.map((row, i) => (
                <RankRowView
                  key={`${row.rank}-${row.displayName}`}
                  row={row}
                  board={board}
                  divider={i < rows.length - 1 && !rows[i + 1]?.isMe}
                />
              ))}
            </PixelPanel>

            {pinned && you && (
              <section className="flex flex-col gap-2" aria-label="Your rank">
                <h2 className="sv-caption font-bold text-fg-muted">Your rank</h2>
                <PixelPanel tone="mint" className="px-3.5 py-0.5">
                  <RankRowView
                    row={you}
                    board={board}
                    divider={false}
                    highlight={false}
                  />
                </PixelPanel>
              </section>
            )}

            {showFooter && (
              <div className="flex flex-col gap-1">
                <p className="sv-caption text-fg-muted">{boardFooter(board)}</p>
                <p className="sv-caption text-fg-muted">
                  {footerLegend(total, anyVerified)}
                </p>
              </div>
            )}
          </>
        )
      )}
    </ScreenShell>
  )
}

function RankRowView({
  row,
  board,
  divider,
  highlight,
}: {
  row: RankRow
  board: Board
  divider: boolean
  /** Defaults to `row.isMe`; the pinned row turns the mint treatment off. */
  highlight?: boolean
}) {
  const isYou = highlight ?? row.isMe
  const bracket = row.bracket ? BRACKETS[row.bracket as Bracket]?.label : undefined
  const rankClass = isYou
    ? 'text-mint'
    : rankTone(row.rank) === 'strong'
      ? 'text-fg'
      : 'text-fg-muted'

  return (
    <Row
      variant={isYou ? 'you' : 'default'}
      minHeight={56}
      divider={divider}
      className="gap-3"
      leading={
        <span
          className={`num w-[26px] shrink-0 text-center text-[14px] font-bold ${rankClass}`}
        >
          <span className="sr-only">Rank </span>
          {row.rank}
        </span>
      }
      trailing={
        <span className="flex shrink-0 items-center gap-3">
          <span className="sv-caption w-[52px] shrink-0 whitespace-nowrap font-bold text-fg-muted">
            {bracket ?? '—'}
            {!bracket && <span className="sr-only">No bracket yet</span>}
          </span>
          <span
            className={`num shrink-0 text-right text-[14px] font-bold ${
              board === 'ranked' ? 'w-12' : 'w-14'
            }`}
          >
            <span className="sr-only">Score </span>
            {row.score}
          </span>
        </span>
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 sv-break text-[15px] leading-[1.2] font-bold">
          {row.displayName}
        </span>
        {row.rank === 1 && <RankCrown />}
        {row.verifiedSaver && (
          <span
            role="img"
            aria-label="Verified saver - funds held in their own vault"
            title="Verified saver - funds held in their own vault"
            className="shrink-0 text-[14px] leading-none text-mint"
          >
            ⟡
          </span>
        )}
        {isYou && <Chip variant="fill">You</Chip>}
      </span>
    </Row>
  )
}

function EmptyPanel({ board }: { board: Board }) {
  return (
    <PixelPanel className="p-6 text-center flex flex-col gap-2">
      <p className="sv-body text-fg-muted">Nobody on this board yet.</p>
      <p className="sv-caption text-fg-faint">
        {board === 'ranked'
          ? 'Ranked play opens at Level 3 with 5 check-ins.'
          : 'Check in and battle — scores build from real play.'}
      </p>
    </PixelPanel>
  )
}

function FriendsEmptyPanel() {
  return (
    <PixelPanel className="p-6 text-center flex flex-col gap-2">
      <p className="sv-body text-fg-muted">No friends on this board yet.</p>
      <p className="sv-caption text-fg-faint">
        Friends are players you&apos;ve fought in a human battle.
      </p>
    </PixelPanel>
  )
}
