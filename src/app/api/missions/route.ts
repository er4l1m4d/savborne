/**
 * GET /api/missions
 *
 * Returns the current mission slate for the caller: the 10 mission definitions
 * from spec Section 6, each annotated with whether it is currently completed
 * (either permanently, for one-time missions; or within the current daily /
 * weekly window, for repeatables).
 *
 * Response:
 *   {
 *     missions: [
 *       {
 *         key, name, description, type, xpReward, bracketRequired,
 *         completed: boolean,
 *         completedAt: string | null,
 *         nextResetAt: string | null,   // for daily/weekly; null for one-time
 *       }
 *     ],
 *     counters: {
 *       dailyXpEarned: number,
 *       dailyXpCap: number,
 *       weeklyXpEarned: number,
 *       weeklyXpCap: number,
 *     }
 *   }
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { DAILY_MISSION_XP_CAP, WEEKLY_MISSION_XP_CAP } from '@/lib/constants'
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

  const [{ data: defs }, { data: credits }, { data: daily }, { data: weeklyRows }] =
    await Promise.all([
      db.from('missions').select('*').order('id'),
      db
        .from('player_missions')
        .select('mission_key, completed_at')
        .eq('player_address', address),
      db
        .from('daily_xp')
        .select('xp_earned')
        .eq('player_address', address)
        .eq('utc_date', today)
        .maybeSingle(),
      db
        .from('check_ins')
        .select('id')
        .eq('player_address', address)
        .gte('recorded_at', weekStart.toISOString()),
    ])

  const allCredited = new Map<string, string>() // key -> completed_at
  for (const row of credits ?? []) {
    // Keep the earliest completion for one-time; for repeatables we re-check below.
    if (!allCredited.has(row.mission_key)) allCredited.set(row.mission_key, row.completed_at)
  }

  const thisWeekCredits = new Set(
    (credits ?? [])
      .filter((r) => new Date(r.completed_at) >= weekStart)
      .map((r) => r.mission_key),
  )

  const now = new Date()
  const missions = (defs ?? []).map((m) => {
    let completed = false
    let completedAt: string | null = null
    let nextResetAt: string | null = null

    if (m.type === 'onetime') {
      const creditedAt = allCredited.get(m.key)
      completed = creditedAt !== undefined
      completedAt = creditedAt ?? null
    } else {
      const credited = thisWeekCredits.has(m.key)
      completed = credited
      completedAt = credited ? allCredited.get(m.key) ?? null : null
      if (m.type === 'daily') {
        const next = new Date(now)
        next.setUTCHours(24, 0, 0, 0)
        nextResetAt = next.toISOString()
      } else if (m.type === 'weekly') {
        const next = new Date(now)
        next.setUTCHours(0, 0, 0, 0)
        const dow = next.getUTCDay()
        const delta = dow === 0 ? 1 : ((8 - dow) % 7) || 7
        next.setUTCDate(next.getUTCDate() + delta)
        nextResetAt = next.toISOString()
      }
    }

    return {
      key: m.key,
      name: m.name,
      description: m.description,
      type: m.type,
      xpReward: m.xp_reward,
      bracketRequired: m.bracket_required,
      completed,
      completedAt,
      nextResetAt,
    }
  })

  return NextResponse.json({
    missions,
    counters: {
      dailyXpEarned: daily?.xp_earned ?? 0,
      dailyXpCap: DAILY_MISSION_XP_CAP,
      weeklyXpEarned: weeklyRows?.length ?? 0, // count-based approximation
      weeklyXpCap: WEEKLY_MISSION_XP_CAP,
    },
  })
}
