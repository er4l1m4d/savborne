/**
 * Savborne — Shared settlement helpers (server-only)
 *
 * Both the check-in route and the battle routes need to: award a list of
 * completed missions through the XP caps, level the player up, maintain the
 * daily/weekly XP ledgers, and apply badge awards/revocations. These
 * functions put that pipeline in one place so the two event types cannot
 * drift apart.
 *
 * Everything here takes an already-created Supabase admin client, so the
 * caller controls the trust boundary. Writes are sequential service-role
 * operations; a mid-pipeline failure is logged and leaves the ledgers
 * eventually-consistent, which is acceptable at v1 scale (see ERRORS.md
 * note on transactional settlement).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { levelFromXp } from '../constants'
import { computeAward, type PlayerXpState, type XpSource } from './awards'
import type { CompletedMission } from './missions'
import { computeBadgeActions, type BadgeKey, type BadgeSnapshot } from './badges'
import { utcDayOf } from './time'

export type MissionAwardSummary = {
  key: string
  xpApplied: number
  xpCapped: number
  onetime: boolean
}

export type SettleMissionsResult = {
  appliedTotal: number
  awarded: MissionAwardSummary[]
  leveledUp: boolean
  newLevel: number
  newXp: number
}

const DAILY_KEYS = new Set(['daily_check_in', 'quick_duel'])
const WEEKLY_KEYS = new Set(['weekly_check_in', 'steady_saver', 'weekly_strategist'])

/**
 * Credit `missions` for `address`, enforcing the daily (25) and weekly (100)
 * mission XP caps, then persist xp/level and the per-day ledger. Missions
 * already credited (one-time ever, repeatable within their window) are
 * skipped. The caller passes `now` so the whole event shares one timestamp.
 */
export async function settleMissions(
  db: SupabaseClient,
  address: string,
  player: { xp: number; level: number; wins: number },
  missions: CompletedMission[],
  now: Date,
): Promise<SettleMissionsResult> {
  const today = utcDayOf(now)
  const weekStart = new Date(now)
  {
    weekStart.setUTCHours(0, 0, 0, 0)
    const dow = weekStart.getUTCDay()
    weekStart.setUTCDate(weekStart.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  }

  // What has already been credited, overall and this week.
  const { data: creditedRows } = await db
    .from('player_missions')
    .select('mission_key, completed_at')
    .eq('player_address', address)
  const allCredited = new Set((creditedRows ?? []).map((r) => r.mission_key))
  const creditedThisWeek = new Set(
    (creditedRows ?? [])
      .filter((r) => new Date(r.completed_at) >= weekStart)
      .map((r) => r.mission_key),
  )

  const toCredit = missions.filter((m) =>
    m.isOnetime ? !allCredited.has(m.key) : !creditedThisWeek.has(m.key),
  )

  // Cap state from ledgers.
  const { data: dailyRow } = await db
    .from('daily_xp')
    .select('xp_earned')
    .eq('player_address', address)
    .eq('utc_date', today)
    .maybeSingle()
  const { data: weeklyMissionRows } = await db
    .from('player_missions')
    .select('mission_key')
    .eq('player_address', address)
    .gte('completed_at', weekStart.toISOString())
  const weeklyMissionCount = (weeklyMissionRows ?? []).filter((r) =>
    WEEKLY_KEYS.has(r.mission_key),
  ).length

  const state: PlayerXpState = {
    xp: player.xp,
    level: player.level,
    dailyXpEarnedToday: dailyRow?.xp_earned ?? 0,
    // Count-based approximation of weekly mission XP (see ERRORS.md plan note).
    weeklyXpEarnedThisWeek: weeklyMissionCount * 33,
  }

  let running = { ...state }
  const awarded: MissionAwardSummary[] = []
  let totalApplied = 0
  let leveledUp = false

  for (const m of toCredit) {
    const source: XpSource = m.isOnetime
      ? { kind: 'onetime_mission', key: m.key }
      : DAILY_KEYS.has(m.key)
        ? { kind: 'daily_mission', key: m.key }
        : WEEKLY_KEYS.has(m.key)
          ? { kind: 'weekly_mission', key: m.key }
          : { kind: 'onetime_mission', key: m.key }
    const r = computeAward(running, m.xp, source)
    totalApplied += r.applied
    if (r.leveledUp) leveledUp = true
    running = {
      xp: running.xp + r.applied,
      level: r.levelAfter,
      dailyXpEarnedToday:
        running.dailyXpEarnedToday + (source.kind === 'daily_mission' ? r.applied : 0),
      weeklyXpEarnedThisWeek:
        running.weeklyXpEarnedThisWeek + (source.kind === 'weekly_mission' ? r.applied : 0),
    }
    awarded.push({ key: m.key, xpApplied: r.applied, xpCapped: r.capped, onetime: m.isOnetime })
  }

  const newXp = running.xp
  const newLevel = levelFromXp(newXp)

  if (toCredit.length > 0) {
    const rows = toCredit.map((m) => ({
      player_address: address,
      mission_key: m.key,
      completed_at: now.toISOString(),
      reset_at: m.isOnetime ? null : computeResetAt(m.key, now),
    }))
    const { error } = await db.from('player_missions').insert(rows)
    if (error) console.error('settleMissions: player_missions insert failed:', error.message)
  }

  if (newXp !== player.xp) {
    const { error } = await db
      .from('players')
      .update({ xp: newXp, level: newLevel })
      .eq('address', address)
    if (error) console.error('settleMissions: player xp update failed:', error.message)
  }

  if (totalApplied > 0) {
    await upsertDailyXp(db, address, today, totalApplied)
  }

  return { appliedTotal: totalApplied, awarded, leveledUp, newLevel, newXp }
}

/** Award uncapped XP (battle outcomes). Independent of mission caps. */
export async function awardRawXp(
  db: SupabaseClient,
  address: string,
  player: { xp: number; level: number },
  amount: number,
): Promise<{ applied: number; leveledUp: boolean; newLevel: number; newXp: number }> {
  const newXp = player.xp + amount
  const newLevel = levelFromXp(newXp)
  if (amount !== 0) {
    const { error } = await db
      .from('players')
      .update({ xp: newXp, level: newLevel })
      .eq('address', address)
    if (error) console.error('awardRawXp: update failed:', error.message)
  }
  return { applied: amount, leveledUp: newLevel > player.level, newLevel, newXp }
}

/**
 * Evaluate badge actions against a snapshot and persist awards/revocations.
 * Returns the actions taken so routes can surface them to the client.
 */
export async function settleBadges(
  db: SupabaseClient,
  address: string,
  snapshot: Omit<BadgeSnapshot, 'daysSinceLastWithdrawalReset' | 'hasBattleWin' | 'hasAnyCheckIn'> &
    Partial<Pick<BadgeSnapshot, 'daysSinceLastWithdrawalReset' | 'hasBattleWin' | 'hasAnyCheckIn'>>,
  now: Date,
): Promise<{ kind: 'award' | 'revoke'; badge: BadgeKey }[]> {
  const { data: activeRows } = await db
    .from('player_badges')
    .select('badge_key')
    .eq('player_address', address)
    .is('revoked_at', null)
  const alreadyActive = new Set<BadgeKey>((activeRows ?? []).map((r) => r.badge_key as BadgeKey))

  const full: BadgeSnapshot = {
    hasAnyCheckIn: snapshot.hasAnyCheckIn ?? false,
    streakCurrent: snapshot.streakCurrent,
    bracket: snapshot.bracket,
    withdrawalJustNow: snapshot.withdrawalJustNow,
    daysSinceLastWithdrawalReset: snapshot.daysSinceLastWithdrawalReset ?? 0,
    hasBattleWin: snapshot.hasBattleWin ?? false,
  }
  const actions = computeBadgeActions(full, alreadyActive)

  for (const action of actions) {
    if (action.kind === 'award') {
      const { error } = await db.from('player_badges').insert({
        player_address: address,
        badge_key: action.badge,
        awarded_at: now.toISOString(),
      })
      if (error) console.error(`settleBadges: award ${action.badge} failed:`, error.message)
    } else {
      const { error } = await db
        .from('player_badges')
        .update({ revoked_at: now.toISOString() })
        .eq('player_address', address)
        .eq('badge_key', action.badge)
        .is('revoked_at', null)
      if (error) console.error(`settleBadges: revoke ${action.badge} failed:`, error.message)
    }
  }
  return actions
}

// ─── internal ────────────────────────────────────────────────────────────────

async function upsertDailyXp(db: SupabaseClient, address: string, day: string, addXp: number) {
  const { data: cur } = await db
    .from('daily_xp')
    .select('xp_earned')
    .eq('player_address', address)
    .eq('utc_date', day)
    .maybeSingle()
  if (cur) {
    const { error } = await db
      .from('daily_xp')
      .update({ xp_earned: cur.xp_earned + addXp })
      .eq('player_address', address)
      .eq('utc_date', day)
    if (error) console.error('upsertDailyXp update failed:', error.message)
    return
  }
  const { error } = await db
    .from('daily_xp')
    .insert({ player_address: address, utc_date: day, xp_earned: addXp })
  if (error) console.error('upsertDailyXp insert failed:', error.message)
}

function computeResetAt(key: string, now: Date): string | null {
  if (DAILY_KEYS.has(key)) {
    const next = new Date(now)
    next.setUTCHours(24, 0, 0, 0)
    return next.toISOString()
  }
  if (WEEKLY_KEYS.has(key)) {
    const next = new Date(now)
    next.setUTCHours(0, 0, 0, 0)
    const dow = next.getUTCDay()
    const delta = dow === 0 ? 1 : ((8 - dow) % 7) || 7
    next.setUTCDate(next.getUTCDate() + delta)
    return next.toISOString()
  }
  return null
}
