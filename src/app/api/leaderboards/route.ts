/**
 * GET /api/leaderboards?board=ranked|unranked&friends=0|1
 *
 * Two boards (spec 10.4):
 *   ranked   — Elo rating desc, wins desc. The main status board.
 *   unranked — combined savings score: amount and consistency weighted
 *              equally, each normalised 0-100 against the cohort maximum
 *              (plan scoring rules). Includes friend and AI battle wins in
 *              the win counts it displays.
 *
 * friends=1 narrows to players you have fought in human battles (the spec's
 * definition of "friends" for v1: sent/received challenges or ranked matches).
 * Only display names are exposed — addresses never leave the server except as
 * a non-rendered key for the caller's own row.
 *
 * `rows` is the top 50. `you` is the caller's full row at its real rank, added
 * so the UI can pin it outside the top 50; it is additive and `null` when the
 * caller has no stats row. `total` stays the pre-slice cohort size.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AI_ADDRESS } from '@/lib/game/battleServer'
import { routeError } from '@/lib/report'
import { rateLimitOrError } from '@/lib/rate-limit'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StatsRow = {
  player_address: string
  display_name: string
  level: number
  bracket: string | null
  rating: number
  wins: number
  losses: number
  ties: number
  streak_current: number
  streak_best: number
  growth_luna: number | string
  /** Derived in `leaderboard_stats()` from the vaults mapping, never a client flag. */
  has_vault: boolean
}

/**
 * The aggregate is cohort-wide, so it is cached for everyone for at most 60s.
 * The bracket inside each row comes from the latest reading in SQL, not from
 * `players.bracket`, so a cron snapshot or a claim is visible on the next
 * refresh even when the player never checked in.
 */
const STATS_TTL_MS = 60_000
let statsCache: { at: number; rows: StatsRow[] } | null = null

async function loadStats(db: ReturnType<typeof supabaseAdmin>): Promise<StatsRow[]> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.rows
  const { data, error } = await db.rpc('leaderboard_stats')
  if (error) throw error
  const rows = (data ?? []) as StatsRow[]
  statsCache = { at: Date.now(), rows }
  return rows
}

export async function GET(req: Request) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address
  const limited = await rateLimitOrError({
    req,
    route: '/api/leaderboards',
    key: `leaderboards:${address}`,
    limit: 120,
    windowSeconds: 60,
  })
  if (limited) return limited

  const url = new URL(req.url)
  const board = url.searchParams.get('board') === 'unranked' ? 'unranked' : 'ranked'
  const friendsOnly = url.searchParams.get('friends') === '1'

  const db = supabaseAdmin()
  let stats: StatsRow[]
  try {
    stats = await loadStats(db)
  } catch (error) {
    return routeError({
      req, route: '/api/leaderboards', code: 'db_error', status: 500, error,
    })
  }

  const friendRows = friendsOnly
    ? await db
        .from('battles')
        .select('player_a, player_b')
        .or(`player_a.eq.${address},player_b.eq.${address}`)
        .neq('mode', 'ai')
    : { data: null }

  let rows = stats
  if (friendsOnly) {
    const set = new Set<string>([address])
    for (const b of (friendRows as { data: { player_a: string; player_b: string | null }[] | null })?.data ?? []) {
      if (b.player_a !== AI_ADDRESS) set.add(b.player_a)
      if (b.player_b && b.player_b !== AI_ADDRESS) set.add(b.player_b)
    }
    rows = rows.filter((r) => set.has(r.player_address))
  }

  if (board === 'ranked') {
    rows.sort((a, b) => b.rating - a.rating || b.wins - a.wins)
  } else {
    // Normalise amount (growth) and consistency (streak) against cohort max,
    // weight equally, average. Zero/negative growth scores 0; a cohort of
    // one just yields 100-vs-0 style extremes, which is honest at this scale.
    const maxGrowth = Math.max(0, ...rows.map((r) => Number(r.growth_luna)))
    const maxStreak = Math.max(0, ...rows.map((r) => r.streak_current))
    for (const r of rows) {
      const amount = maxGrowth > 0 ? Math.min(100, Math.round((Math.max(0, Number(r.growth_luna)) / maxGrowth) * 100)) : 0
      const consistency = maxStreak > 0 ? Math.min(100, Math.round((r.streak_current / maxStreak) * 100)) : 0
      r.rating = Math.round((amount + consistency) / 2) // reuse rating slot as score for the UI
      r.losses = amount // sub-scores for the row detail
      r.ties = consistency
    }
    rows.sort((a, b) => b.rating - a.rating || b.streak_current - a.streak_current || b.wins - a.wins)
  }

  const toRow = (r: StatsRow, i: number) => ({
    rank: i + 1,
    displayName: r.display_name,
    level: r.level,
    bracket: r.bracket,
    score: r.rating,
    wins: r.wins,
    amountScore: board === 'unranked' ? r.losses : null,
    consistencyScore: board === 'unranked' ? r.ties : null,
    streak: r.streak_current,
    isMe: r.player_address === address,
    // A badge, not a ranking input: `rows` is already sorted before this map.
    verifiedSaver: r.has_vault === true,
  })

  const all = rows.map(toRow)
  const top = all.slice(0, 50)
  const you = all.find((r) => r.isMe) ?? null

  return NextResponse.json({ board, friendsOnly, rows: top, total: all.length, you })
}
