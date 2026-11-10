/**
 * Savborne - exact weekly mission accounting (server-only)
 *
 * The weekly mission cap is a sum of rewards, not a count of events. These
 * helpers read the week's `player_missions` credits, keep one per weekly
 * mission, take the reward from the mission definitions and clamp the total to
 * `WEEKLY_MISSION_XP_CAP`. Every weekly XP figure the app returns comes from
 * here so the endpoints, the check-in cap headroom and battle settlement
 * cannot drift.
 *
 * `weeklyHumanWins` is the matching win count for Weekly Strategist. It counts
 * human (`ranked` / `unranked`) battles only; an AI win is not a human win and
 * must never feed the mission or its meter.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { WEEKLY_MISSION_XP_CAP } from '../constants'
import { utcWeekStart } from './time'

export type WeeklyCredit = {
  mission_key: string
  completed_at: string
}

export type MissionXpDef = {
  key: string
  type: string
  xp_reward: number
}

/**
 * Pure core for the weekly counter. `credits` may include rows outside the
 * window (a fake or an over-broad query); the window is applied here so the
 * boundary is unit-testable. Dedupes by mission key, ignores definitions that
 * are not `weekly`, and clamps the exact reward sum to the weekly cap.
 */
export function sumWeeklyMissionXp(
  credits: WeeklyCredit[],
  defs: MissionXpDef[],
  now: Date,
): number {
  const weekStart = utcWeekStart(now).getTime()
  const keys = new Set(
    credits
      .filter((credit) => new Date(credit.completed_at).getTime() >= weekStart)
      .map((credit) => credit.mission_key),
  )
  if (keys.size === 0) return 0

  const weeklyRewards = new Map(
    defs
      .filter((def) => def.type === 'weekly')
      .map((def) => [def.key, Number(def.xp_reward ?? 0)]),
  )

  let total = 0
  for (const key of keys) total += weeklyRewards.get(key) ?? 0
  return Math.min(WEEKLY_MISSION_XP_CAP, Math.max(0, total))
}

/** Exact weekly mission XP earned since Monday 00:00 UTC. */
export async function weeklyMissionXp(
  db: SupabaseClient,
  address: string,
  now: Date,
): Promise<number> {
  const weekStart = utcWeekStart(now)
  const { data: credits } = await db
    .from('player_missions')
    .select('mission_key, completed_at')
    .eq('player_address', address)
    .gte('completed_at', weekStart.toISOString())

  const rows = (credits ?? []) as WeeklyCredit[]
  if (rows.length === 0) return 0

  const keys = [...new Set(rows.map((row) => row.mission_key))]
  const { data: defs } = await db
    .from('missions')
    .select('key, type, xp_reward')
    .in('key', keys)

  return sumWeeklyMissionXp(rows, (defs ?? []) as MissionXpDef[], now)
}

/**
 * Human battle wins in the current UTC week, before `now`.
 *
 * `completed_at < now` excludes a battle completed at this instant (the one
 * being settled), so callers receive the count *before* the current result.
 */
export async function weeklyHumanWins(
  db: SupabaseClient,
  address: string,
  now: Date,
): Promise<number> {
  const weekStart = utcWeekStart(now)
  const { data } = await db
    .from('battles')
    .select('id')
    .eq('winner', address)
    .in('mode', ['ranked', 'unranked'])
    .gte('completed_at', weekStart.toISOString())
    .lt('completed_at', now.toISOString())

  return (data ?? []).length
}
