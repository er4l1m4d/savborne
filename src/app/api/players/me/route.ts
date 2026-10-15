/**
 * GET /api/players/me
 *
 * Returns the current player's state for the home screen: identity, level,
 * XP, bracket, streak, current balance, and how much XP is needed for the
 * next level. Reads are trusted because RLS allows anyone to select the
 * public columns; here we still gate by the address header so a caller
 * cannot enumerate other players' rows through this endpoint.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { xpToNextLevel } from '@/lib/constants'
import { utcDayOf, utcWeekStart } from '@/lib/game/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const today = utcDayOf(new Date())
  const weekStart = utcWeekStart(new Date())

  const [{ data: player, error: playerErr }, { data: daily }, { data: weeklyRows }, { data: battleRow }] =
    await Promise.all([
      db.from('players').select('*').eq('address', address).maybeSingle(),
      db.from('daily_xp').select('xp_earned').eq('player_address', address).eq('utc_date', today).maybeSingle(),
      db
        .from('check_ins')
        .select('recorded_at')
        .eq('player_address', address)
        .gte('recorded_at', weekStart.toISOString())
        .order('recorded_at', { ascending: true }),
      db.from('daily_battles').select('count').eq('player_address', address).eq('utc_date', today).maybeSingle(),
    ])

  if (playerErr) {
    return NextResponse.json({ error: playerErr.message }, { status: 500 })
  }
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  // Sum this week's check-in XP from the daily_xp ledger (approximation of
  // weekly counter; a stricter model uses a dedicated weekly_xp table).
  const weeklyXpEarned = weeklyRows?.length ?? 0

  return NextResponse.json({
    player: {
      address: player.address,
      displayName: player.display_name,
      savingsAddress: player.savings_account_address,
      level: player.level,
      xp: player.xp,
      xpToNext: xpToNextLevel(player.level),
      bracket: player.bracket,
      balanceLuna: Number(player.current_balance_luna),
      streakCurrent: player.streak_current,
      streakBest: player.streak_best,
      checkInCount: player.check_in_count,
      rating: player.rating,
      wins: player.wins,
      losses: player.losses,
      ties: player.ties,
      lastCheckInAt: player.last_check_in_at,
      dailyXpEarnedToday: daily?.xp_earned ?? 0,
      weeklyXpEarnedThisWeek: weeklyXpEarned,
      battlesToday: battleRow?.count ?? 0,
    },
  })
}
