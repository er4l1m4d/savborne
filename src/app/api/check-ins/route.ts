/**
 * POST /api/check-ins
 *
 * Records a balance snapshot for the caller, then runs the mission + XP
 * pipeline against that snapshot. Returns the updated player row plus a
 * summary of what was awarded and any level/bracket change.
 *
 * The client sends the balance it read from `getBalance()` on-device, since
 * the server cannot reach the wallet. This is a trust-based model — a
 * malicious user could lie about their balance to farm XP — but per the
 * spec, Savborne never holds money, so the game's value is social/status
 * rather than financial. A future version can verify the balance by calling
 * the Nimiq public RPC independently.
 *
 * Body: { balanceLuna: number }
 * Header: X-Player-Address: <address>
 *
 * Steps performed inside this handler (kept linear; a real Postgres
 * transaction is added in migration 0002 via `record_check_in` RPC):
 *   1. Load the player's current row + recent check-in history.
 *   2. Insert a new check_ins row.
 *   3. Evaluate which missions newly qualified (First Steps, Daily Check-in,
 *      Weekly Check-in, Rising Tide, Steady Saver, Bracket Climb).
 *   4. Award XP for each via `computeAward`, respecting daily/weekly caps.
 *   5. Recompute streak.
 *   6. Detect bracket change and level-up; write both.
 *   7. Update daily_xp ledger.
 *   8. Return the aggregate result to the client for animation.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { bracketFromLuna, levelFromXp, xpToNextLevel, type Bracket } from '@/lib/constants'
import { computeAward, type PlayerXpState, type XpSource } from '@/lib/game/awards'
import { evaluateForCheckIn, type CompletedMission } from '@/lib/game/missions'
import { computeStreak, alreadyCheckedInToday, alreadyCheckedInThisWeek } from '@/lib/game/streaks'
import { utcDayOf, utcWeekStart, utcDaysBetween } from '@/lib/game/time'
import { itemsToUnlock, type ItemKey } from '@/lib/game/items'
import { computeBadgeActions, type BadgeKey } from '@/lib/game/badges'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing X-Player-Address header' }, { status: 401 })
  }

  let body: { balanceLuna?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const balanceLuna = body.balanceLuna
  if (typeof balanceLuna !== 'number' || !Number.isFinite(balanceLuna) || balanceLuna < 0) {
    return NextResponse.json({ error: 'balanceLuna must be a non-negative number' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const now = new Date()
  const today = utcDayOf(now)
  const weekStart = utcWeekStart(now)

  // 1. Load player + recent history.
  const { data: player, error: playerErr } = await db
    .from('players')
    .select('*')
    .eq('address', address)
    .maybeSingle()
  if (playerErr) return NextResponse.json({ error: playerErr.message }, { status: 500 })
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const { data: history } = await db
    .from('check_ins')
    .select('balance_luna, recorded_at')
    .eq('player_address', address)
    .order('recorded_at', { ascending: false })
    .limit(60)
  const prior = history ?? []

  // Owned items, loaded early so the Ledger Scroll XP bonus applies to this
  // check-in's awards. Items unlocked *during* this check-in take effect
  // from the next one.
  const { data: ownedItemRows } = await db
    .from('player_items')
    .select('item_key')
    .eq('player_address', address)
  const hasLedgerScroll = (ownedItemRows ?? []).some((r) => r.item_key === 'ledger_scroll')

  // 2. Insert new check-in.
  const { error: insertErr } = await db.from('check_ins').insert({
    player_address: address,
    balance_luna: Math.floor(balanceLuna),
    recorded_at: now.toISOString(),
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // 3. Build the mission snapshot.
  const alreadyToday = alreadyCheckedInToday(prior.map((r) => new Date(r.recorded_at)), now)
  const alreadyWeek = alreadyCheckedInThisWeek(prior.map((r) => new Date(r.recorded_at)), now)
  const priorMostRecent = prior.length > 0 ? Number(prior[0].balance_luna) : null
  const thisWeekRows = prior.filter((r) => new Date(r.recorded_at) >= weekStart)
  const weekOpening = thisWeekRows.length > 0 ? Number(thisWeekRows[thisWeekRows.length - 1].balance_luna) : null

  // Detect withdrawals within this week: any consecutive pair where the later
  // balance is strictly less than the earlier one.
  let anyWithdrawalThisWeek = false
  for (let i = thisWeekRows.length - 1; i > 0; i--) {
    const later = Number(thisWeekRows[i - 1].balance_luna)
    const earlier = Number(thisWeekRows[i].balance_luna)
    if (later < earlier) {
      anyWithdrawalThisWeek = true
      break
    }
  }

  const newBracket: Bracket | null = bracketFromLuna(balanceLuna)
  const currentBracket: Bracket | null = (player.bracket as Bracket | null) ?? null

  const snapshot = {
    currentBalanceLuna: balanceLuna,
    previousBalanceLuna: priorMostRecent,
    weekOpeningBalanceLuna: weekOpening,
    anyWithdrawalThisWeek,
    alreadyCheckedInToday: alreadyToday,
    alreadyCheckedInThisWeek: alreadyWeek,
    totalCheckInsBefore: player.check_in_count,
    currentBracket: newBracket,
  }
  const qualified = evaluateForCheckIn(snapshot)

  // Ledger Scroll: +5% XP from check-in missions (spec Section 7).
  if (hasLedgerScroll) {
    for (const m of qualified) {
      if (m.key === 'daily_check_in' || m.key === 'weekly_check_in') {
        m.xp = Math.round(m.xp * 1.05)
      }
    }
  }

  // Filter out missions that are already credited. For one-time missions we
  // check the full history; for repeatables we only check the current window.
  const { data: creditedRows } = await db
    .from('player_missions')
    .select('mission_key, completed_at')
    .eq('player_address', address)
  const allCreditedKeys = new Set((creditedRows ?? []).map((r) => r.mission_key))
  const creditedThisWeek = new Set(
    (creditedRows ?? [])
      .filter((r) => new Date(r.completed_at) >= weekStart)
      .map((r) => r.mission_key),
  )

  const toCredit = qualified.filter((m) =>
    m.isOnetime ? !allCreditedKeys.has(m.key) : !creditedThisWeek.has(m.key),
  )

  // 4. Award XP sequentially through the caps.
  const dailyHeadroomState: PlayerXpState = {
    xp: player.xp,
    level: player.level,
    dailyXpEarnedToday: await dailyXpToday(),
    weeklyXpEarnedThisWeek: await weeklyXpThisWeek(),
  }
  let running: PlayerXpState = { ...dailyHeadroomState }
  let totalApplied = 0
  let leveledUp = false
  const awards: { mission: CompletedMission; applied: number; capped: number }[] = []

  for (const m of toCredit) {
    const source: XpSource = m.isOnetime
      ? { kind: 'onetime_mission', key: m.key }
      : isDailyMissionKey(m.key)
        ? { kind: 'daily_mission', key: m.key }
        : { kind: 'weekly_mission', key: m.key }
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
    awards.push({ mission: m, applied: r.applied, capped: r.capped })
  }

  // 5. Recompute streak.
  const allCheckInDates = [now, ...prior.map((r) => new Date(r.recorded_at))]
  const streak = computeStreak({ checkInsAt: allCheckInDates, now })

  // 6-7. Write player row + ledger rows + mission credits.
  const newXp = running.xp
  const newLevel = levelFromXp(newXp)

  const updates: Record<string, unknown> = {
    current_balance_luna: Math.floor(balanceLuna),
    last_check_in_at: now.toISOString(),
    check_in_count: player.check_in_count + 1,
    xp: newXp,
    level: newLevel,
    streak_current: streak.current,
    streak_best: Math.max(player.streak_best, streak.current),
    grace_used_this_week: streak.graceUsedThisWeek,
    bracket: newBracket,
  }
  // Withdrawal detection: a lower balance than the last snapshot flips the
  // flag; a higher or equal balance clears it.
  if (priorMostRecent !== null && balanceLuna < priorMostRecent) {
    updates.withdrawal_in_progress = true
    updates.last_withdrawal_at = now.toISOString()
  } else if (priorMostRecent !== null && balanceLuna >= priorMostRecent) {
    updates.withdrawal_in_progress = false
  }

  const playerUpdRes = await db.from('players').update(updates).eq('address', address)
  if (playerUpdRes.error) {
    return NextResponse.json({ error: playerUpdRes.error.message }, { status: 500 })
  }
  const dailyErr = await upsertDailyXp(today, totalApplied)
  if (dailyErr) {
    return NextResponse.json({ error: dailyErr }, { status: 500 })
  }

  // Write player_missions for each credited mission.
  if (toCredit.length > 0) {
    const rows = toCredit.map((m) => ({
      player_address: address,
      mission_key: m.key,
      completed_at: now.toISOString(),
      reset_at: m.isOnetime ? null : computeResetAt(m.key, now),
    }))
    const { error: missionErr } = await db.from('player_missions').insert(rows)
    if (missionErr) {
      // Non-fatal for the check-in itself; log for later inspection.
      console.error('Failed to write player_missions:', missionErr.message)
    }
  }

  // 8. Item unlocks on bracket reach. Once unlocked, items never re-lock.
  const ownedKeys = new Set<ItemKey>((ownedItemRows ?? []).map((r) => r.item_key as ItemKey))
  const unlockList = itemsToUnlock(ownedKeys, newBracket)
  let unlockedItems: ItemKey[] = []
  if (unlockList.length > 0) {
    const insertRows = unlockList.map((k) => ({
      player_address: address,
      item_key: k,
      unlocked_at: now.toISOString(),
    }))
    const { error: itemErr } = await db.from('player_items').insert(insertRows)
    if (itemErr) {
      console.error('Failed to write player_items:', itemErr.message)
    } else {
      unlockedItems = unlockList
    }
  }

  // 9. Badge awards and revocations.
  const { data: activeBadgeRows } = await db
    .from('player_badges')
    .select('badge_key')
    .eq('player_address', address)
    .is('revoked_at', null)
  const alreadyActive = new Set<BadgeKey>(
    (activeBadgeRows ?? []).map((r) => r.badge_key as BadgeKey),
  )
  const daysSinceLastWithdrawalReset = player.steady_hand_started_at
    ? utcDaysBetween(new Date(player.steady_hand_started_at), now)
    : 0
  const badgeSnapshot = {
    hasAnyCheckIn: true, // we just inserted one
    streakCurrent: streak.current,
    bracket: newBracket,
    withdrawalJustNow: priorMostRecent !== null && balanceLuna < priorMostRecent,
    daysSinceLastWithdrawalReset,
    hasBattleWin: player.wins > 0,
  }
  const badgeActions = computeBadgeActions(badgeSnapshot, alreadyActive)
  for (const action of badgeActions) {
    if (action.kind === 'award') {
      const { error } = await db.from('player_badges').insert({
        player_address: address,
        badge_key: action.badge,
        awarded_at: now.toISOString(),
        revoked_at: null,
      })
      if (error) console.error(`Failed to award badge ${action.badge}:`, error.message)
    } else {
      const { error } = await db
        .from('player_badges')
        .update({ revoked_at: now.toISOString() })
        .eq('player_address', address)
        .eq('badge_key', action.badge)
        .is('revoked_at', null)
      if (error) console.error(`Failed to revoke badge ${action.badge}:`, error.message)
    }
  }

  // If a withdrawal just happened, restart the Steady Hand counter.
  if (badgeSnapshot.withdrawalJustNow) {
    const { error: steadyErr } = await db
      .from('players')
      .update({ steady_hand_started_at: now.toISOString() })
      .eq('address', address)
    if (steadyErr) console.error('Failed to reset steady_hand_started_at:', steadyErr.message)
  }

  return NextResponse.json({
    ok: true,
    awarded: awards.map((a) => ({
      key: a.mission.key,
      xpApplied: a.applied,
      xpCapped: a.capped,
      onetime: a.mission.isOnetime,
    })),
    leveledUp,
    newLevel,
    newXp,
    xpToNext: xpToNextLevel(newLevel),
    streakCurrent: streak.current,
    bracket: newBracket,
    bracketChanged: newBracket !== currentBracket,
    withdrawalDetected: priorMostRecent !== null && balanceLuna < priorMostRecent,
    balanceLuna: Math.floor(balanceLuna),
    unlockedItems,
    badgeActions,
  })

  // ── helpers defined inside the handler so they close over `db` + `address` ──

  async function dailyXpToday(): Promise<number> {
    const { data } = await db
      .from('daily_xp')
      .select('xp_earned')
      .eq('player_address', address)
      .eq('utc_date', today)
      .maybeSingle()
    return data?.xp_earned ?? 0
  }

  async function weeklyXpThisWeek(): Promise<number> {
    const { data } = await db
      .from('player_missions')
      .select('mission_key')
      .eq('player_address', address)
      .gte('completed_at', weekStart.toISOString())
    // Rough: assume each weekly mission averages 33 XP; the mission definitions
    // table has exact values but a single-row-per-mission count is close enough
    // for the cap. For stricter accounting, use a dedicated weekly_xp ledger.
    const weeklyCount = (data ?? []).filter((r) => isWeeklyMissionKey(r.mission_key)).length
    return weeklyCount * 33
  }

  async function upsertDailyXp(day: string, addXp: number): Promise<string | null> {
    if (addXp <= 0) return null
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
      return error?.message ?? null
    }
    const { error } = await db.from('daily_xp').insert({
      player_address: address,
      utc_date: day,
      xp_earned: addXp,
    })
    return error?.message ?? null
  }
}

// ─── Static helpers (module scope) ──────────────────────────────────────────

const DAILY_KEYS = new Set(['daily_check_in', 'quick_duel'])
const WEEKLY_KEYS = new Set(['weekly_check_in', 'steady_saver', 'weekly_strategist'])

function isDailyMissionKey(k: string): boolean {
  return DAILY_KEYS.has(k)
}
function isWeeklyMissionKey(k: string): boolean {
  return WEEKLY_KEYS.has(k)
}

/**
 * For a repeatable mission, the UTC instant at which its next-completion
 * window opens. For daily: tomorrow 00:00 UTC. For weekly: next Monday 00:00 UTC.
 */
function computeResetAt(key: string, now: Date): string | null {
  if (isDailyMissionKey(key)) {
    const next = new Date(now)
    next.setUTCHours(0, 0, 0, 0)
    next.setUTCDate(next.getUTCDate() + 1)
    return next.toISOString()
  }
  if (isWeeklyMissionKey(key)) {
    const next = new Date(now)
    next.setUTCHours(0, 0, 0, 0)
    const dow = next.getUTCDay()
    const delta = dow === 0 ? 1 : (8 - dow) % 7 || 7
    next.setUTCDate(next.getUTCDate() + delta)
    return next.toISOString()
  }
  return null
}
