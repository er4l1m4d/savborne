/**
 * POST /api/check-ins
 *
 * Records a balance snapshot for the caller, then runs the mission + XP
 * pipeline against that snapshot. Returns the updated player row plus a
 * summary of what was awarded and any level/bracket change.
 *
 * The balance is read from the chain, not from the client. The request body is
 * ignored entirely: it neither supplies nor can influence the snapshot. A
 * player without a vault gets `409 vault_required` rather than a fallback to a
 * client-reported number, which is the hole this build exists to close.
 *
 * Headers:
 *   X-Player-Address: <address>
 *   X-Savborne-Check-In-Public-Key: <64 hex>
 *   X-Savborne-Check-In-Signature: <128 hex>
 *   X-Savborne-Check-In-Signed-At: <unix ms>
 *
 * Trust: the address header is identity, not authority. Every check-in must
 * carry a wallet signature over `checkInMessage` (the `Savborne check-in`
 * namespace, the normalised address, the `check-in` action and the signed-at
 * time), verified against the key that derives the header address. The proof
 * is shape-checked before any I/O and verified after the rate limit but before
 * any table or chain read. The delete proof uses different headers and a
 * different namespace, so neither can authorise the other. The message does
 * not bind the vault or balance; the server reads those itself.
 *
 * Cron policy: any future server-triggered check-in or claim path must
 * authenticate with a separate `CRON_SECRET` and must never accept a player
 * header as authority. Do not reuse these proof headers for a server job.
 *
 * Integrity release gate (supabase/FINAL-SCHEMA.sql):
 *   1. A database fixed-window rate limit runs before any table or chain read.
 *   2. A reading is one row per player per UTC day (`check_ins.utc_date`).
 *   3. A same-day POST returns the normal response shape with
 *      `alreadyCheckedIn: true` and no awards, without touching the chain.
 *   4. `commit_check_in` writes the reading, the player row, daily XP, mission
 *      credits, item unlocks and badge changes in ONE transaction. It derives
 *      `players.check_in_count` from the distinct-day rows, so five POSTs in
 *      one UTC day can never unlock ranked.
 *
 * Steps:
 *   1. Check the player header and the proof shape.
 *   2. Rate limit, then verify the signature.
 *   3. Load the player, vault and recent history.
 *   4. Return early when today's reading already exists.
 *   5. Read the balance from the chain.
 *   6. Evaluate missions, awards, streak, badge actions and unlocks.
 *   7. Commit everything through `commit_check_in`.
 *   8. Return the aggregate result to the client for animation.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { bracketFromLuna, levelFromXp, xpToNextLevel, type Bracket } from '@/lib/constants'
import { computeAward, type PlayerXpState, type XpSource } from '@/lib/game/awards'
import { evaluateForCheckIn, type CompletedMission } from '@/lib/game/missions'
import { computeStreak, alreadyCheckedInThisWeek } from '@/lib/game/streaks'
import { utcDayOf, utcWeekStart, utcDaysBetween } from '@/lib/game/time'
import { itemsToUnlock, type ItemKey } from '@/lib/game/items'
import { computeBadgeActions, type BadgeKey } from '@/lib/game/badges'
import type { Network } from '@/lib/nimiq'
import { getAccount, RpcError } from '@/lib/vault/rpc'
import { weeklyMissionXp } from '@/lib/game/weekly-missions'
import { readCheckInProof } from '@/lib/checkin-request'
import { verifyCheckInSignature } from '@/lib/checkin-verify'
import { routeError } from '@/lib/report'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 10 requests per 60 seconds per player address, before any expensive work. */
const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

type CheckInRowLite = {
  balance_luna: number
  recorded_at: string
  claimed_at: string | null
  bracket: string | null
}

export async function POST(req: Request) {
  const auth = await requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address

  // A proof is required for every POST and is shape-checked before any I/O.
  // Missing, stale and malformed proofs cost no database or chain read.
  const proof = readCheckInProof(req.headers, Date.now())
  if (!proof.ok) {
    return NextResponse.json(
      { error: proof.reason },
      { status: proof.reason === 'malformed' ? 400 : 401 },
    )
  }

  const db = supabaseAdmin()
  const now = new Date()
  const today = utcDayOf(now)
  const weekStart = utcWeekStart(now)

  // 1. Rate limit before any table or chain read. A denied request is cheap,
  //    and it also bounds signature verification to the same window.
  const { data: rate, error: rateErr } = await db.rpc('consume_rate_limit', {
    p_key: `check-in:${address}`,
    p_limit: RATE_LIMIT.limit,
    p_window_seconds: RATE_LIMIT.windowSeconds,
  })
  if (rateErr) {
    return routeError({
      req, route: '/api/check-ins', code: 'db_error', status: 500, error: rateErr,
    })
  }
  if (rate && rate.allowed === false) {
    const retryAfter = Number(rate.retryAfterSeconds ?? RATE_LIMIT.windowSeconds)
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // 2. Verify the signature. The key must derive the header address, so a
  //    proof signed by another wallet is `wrong_signer`, not consent. This is
  //    still before any table read: a bad signature never touches the player.
  let verified
  try {
    verified = await verifyCheckInSignature({ address, proof: proof.proof })
  } catch (err) {
    return routeError({
      req, route: '/api/check-ins', code: 'verification_failed', status: 500, error: err,
    })
  }
  if (!verified.ok) {
    return NextResponse.json(
      { error: verified.reason },
      { status: verified.reason === 'malformed' ? 400 : 401 },
    )
  }

  // 3. Load the player and their vault. The body is deliberately unread: there
  //    is nothing a client can send that changes the balance.
  const { data: player, error: playerErr } = await db
    .from('players')
    .select('*')
    .eq('address', address)
    .maybeSingle()
  if (playerErr) {
    return routeError({
      req, route: '/api/check-ins', code: 'db_error', status: 500, error: playerErr,
    })
  }
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const { data: vault, error: vaultErr } = await db
    .from('vaults')
    .select('address, network')
    .eq('player_address', address)
    .maybeSingle()
  if (vaultErr) {
    return routeError({
      req, route: '/api/check-ins', code: 'db_error', status: 500, error: vaultErr,
    })
  }
  if (!vault) {
    // No vault, no trusted balance. Never fall back to a client-reported one.
    return NextResponse.json({ error: 'vault_required' }, { status: 409 })
  }

  const { data: history } = await db
    .from('check_ins')
    .select('balance_luna, recorded_at, claimed_at, bracket')
    .eq('player_address', address)
    .order('recorded_at', { ascending: false })
    .limit(60)
  const readings = (history ?? []) as CheckInRowLite[]
  const todayRow = readings.find((r) => utcDayOf(new Date(r.recorded_at)) === today)
  const priorReadings = readings.filter((r) => utcDayOf(new Date(r.recorded_at)) !== today)
  // The ritual (streak, weekly mission, ranked) counts claimed days only. A
  // cron snapshot keeps standing fresh but does not perform the check-in.
  const claimedDays = priorReadings.filter((r) => r.claimed_at !== null)

  // A same-day POST after a claim is idempotent. Return the normal shape with
  // empty awards and do not read the chain: the reading already exists.
  if (todayRow && todayRow.claimed_at !== null) {
    return NextResponse.json(alreadyCheckedInResponse(player))
  }

  // 4. Prefer today's cron reading when one exists: the claim awards against
  //    the snapshot the server already stored. Otherwise read the chain. No
  //    fallback: an RPC outage is a check-in outage, never a zero balance.
  let balanceLuna: number
  let readingBracket: Bracket | null
  if (todayRow) {
    balanceLuna = Number(todayRow.balance_luna)
    readingBracket = (todayRow.bracket as Bracket | null) ?? bracketFromLuna(balanceLuna)
  } else {
    let account: Awaited<ReturnType<typeof getAccount>>
    try {
      account = await getAccount(vault.address, vault.network as Network)
    } catch (err) {
      if (err instanceof RpcError) {
        return routeError({
          req, route: '/api/check-ins', code: 'rpc_unreachable', status: 503, error: err,
        })
      }
      return routeError({
        req, route: '/api/check-ins', code: 'db_error', status: 500, error: err,
      })
    }
    balanceLuna = account.balanceLuna
    readingBracket = bracketFromLuna(balanceLuna)
  }

  // Owned items, loaded early so the Ledger Scroll XP bonus applies to this
  // check-in's awards. Items unlocked *during* this check-in take effect
  // from the next one.
  const { data: ownedItemRows } = await db
    .from('player_items')
    .select('item_key')
    .eq('player_address', address)
  const hasLedgerScroll = (ownedItemRows ?? []).some((r) => r.item_key === 'ledger_scroll')

  // 5. Build the mission snapshot.
  const alreadyWeek = alreadyCheckedInThisWeek(
    claimedDays.map((r) => new Date(r.recorded_at)),
    now,
  )
  const priorMostRecent =
    priorReadings.length > 0 ? Number(priorReadings[0].balance_luna) : null
  const thisWeekRows = priorReadings.filter((r) => new Date(r.recorded_at) >= weekStart)
  const weekOpening =
    thisWeekRows.length > 0
      ? Number(thisWeekRows[thisWeekRows.length - 1].balance_luna)
      : null

  // Detect withdrawals within this week: any consecutive pair where the later
  // balance is strictly less than the earlier one, OR a settled outgoing
  // transfer this week. A non-custodial vault can be drained outside Savborne,
  // and the balance delta is the only trace of that. Both feed the mission.
  let anyWithdrawalThisWeek = false
  for (let i = thisWeekRows.length - 1; i > 0; i--) {
    const later = Number(thisWeekRows[i - 1].balance_luna)
    const earlier = Number(thisWeekRows[i].balance_luna)
    if (later < earlier) {
      anyWithdrawalThisWeek = true
      break
    }
  }
  const { count: settledOutThisWeek } = await db
    .from('transfers')
    .select('id', { count: 'exact', head: true })
    .eq('player_address', address)
    .eq('direction', 'out')
    .eq('status', 'included')
    .gte('confirmed_at', weekStart.toISOString())
  if ((settledOutThisWeek ?? 0) > 0) anyWithdrawalThisWeek = true

  // First-deposit mission input: at least one settled (included) deposit ever.
  // A pending claim must never unlock it.
  const { count: includedDeposits } = await db
    .from('transfers')
    .select('id', { count: 'exact', head: true })
    .eq('player_address', address)
    .eq('direction', 'in')
    .eq('status', 'included')
  const hasIncludedDeposit = (includedDeposits ?? 0) > 0

  const newBracket: Bracket | null = readingBracket
  const currentBracket: Bracket | null = (player.bracket as Bracket | null) ?? null
  const withdrewNow = priorMostRecent !== null && balanceLuna < priorMostRecent

  const snapshot = {
    currentBalanceLuna: balanceLuna,
    previousBalanceLuna: priorMostRecent,
    weekOpeningBalanceLuna: weekOpening,
    // A withdrawal at this check-in disqualifies Steady Saver too (spec 6.3:
    // "withdrawals reset this mission for the week").
    anyWithdrawalThisWeek: anyWithdrawalThisWeek || withdrewNow,
    alreadyCheckedInToday: false,
    alreadyCheckedInThisWeek: alreadyWeek,
    totalCheckInsBefore: player.check_in_count,
    currentBracket: newBracket,
    hasIncludedDeposit,
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

  // 6. Award XP sequentially through the caps.
  const dailyHeadroomState: PlayerXpState = {
    xp: player.xp,
    level: player.level,
    dailyXpEarnedToday: await dailyXpToday(),
    weeklyXpEarnedThisWeek: await weeklyMissionXp(db, address, now),
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

  // 7. Recompute streak.
  const allCheckInDates = [now, ...claimedDays.map((r) => new Date(r.recorded_at))]
  const streak = computeStreak({
    checkInsAt: allCheckInDates,
    now,
    shields: player.shields ?? 1,
    shieldsEarned: player.shields_earned ?? 0,
  })

  const newXp = running.xp
  const newLevel = levelFromXp(newXp)

  // 8. Item unlocks on bracket reach. Once unlocked, items never re-lock.
  const ownedKeys = new Set<ItemKey>((ownedItemRows ?? []).map((r) => r.item_key as ItemKey))
  const unlockList = itemsToUnlock(ownedKeys, newBracket)

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
    hasAnyCheckIn: true,
    streakCurrent: streak.current,
    bracket: newBracket,
    withdrawalJustNow: withdrewNow,
    daysSinceLastWithdrawalReset,
    hasBattleWin: player.wins > 0,
  }
  const badgeActions = computeBadgeActions(badgeSnapshot, alreadyActive)

  // The Golden Crown is an item as well as a badge. Persist the item row in the
  // same transaction so a later demotion cannot re-lock it.
  const crownAwarded = badgeActions.some(
    (action) => action.kind === 'award' && action.badge === 'golden_crown',
  )
  const itemKeys = new Set<ItemKey>(unlockList)
  if (crownAwarded) itemKeys.add('golden_crown')
  const unlockedItems = [...itemKeys]

  // 10. One transaction for the reading and every reward.
  const playerPatch: Record<string, unknown> = {
    current_balance_luna: Math.floor(balanceLuna),
    last_check_in_at: now.toISOString(),
    xp: newXp,
    level: newLevel,
    streak_current: streak.current,
    streak_best: Math.max(player.streak_best, streak.current),
    shields: streak.shields,
    shields_earned: streak.shieldsEarned,
    bracket: newBracket,
  }
  // A lower balance flips the withdrawal flag and restarts Steady Hand. A
  // higher or equal balance clears the flag. No prior reading leaves both as-is.
  if (priorMostRecent !== null && balanceLuna < priorMostRecent) {
    playerPatch.withdrawal_in_progress = true
    playerPatch.last_withdrawal_at = now.toISOString()
    playerPatch.steady_hand_started_at = now.toISOString()
  } else if (priorMostRecent !== null && balanceLuna >= priorMostRecent) {
    playerPatch.withdrawal_in_progress = false
  }

  const { data: committed, error: commitErr } = await db.rpc('commit_check_in', {
    p_address: address,
    p_balance_luna: Math.floor(balanceLuna),
    p_recorded_at: now.toISOString(),
    p_player: playerPatch,
    p_daily_xp: totalApplied,
    p_missions: toCredit.map((m) => ({
      mission_key: m.key,
      completed_at: now.toISOString(),
      reset_at: m.isOnetime ? null : computeResetAt(m.key, now),
    })),
    p_items: unlockedItems.map((key) => ({
      item_key: key,
      unlocked_at: now.toISOString(),
    })),
    p_badges: badgeActions.map((action) =>
      action.kind === 'award'
        ? { badge_key: action.badge, action: 'award', at: now.toISOString() }
        : { badge_key: action.badge, action: 'revoke', at: now.toISOString() },
    ),
  })
  if (commitErr) {
    return routeError({
      req, route: '/api/check-ins', code: 'db_error', status: 500, error: commitErr,
    })
  }
  if (!committed || committed.claimed === false) {
    // A concurrent request won the reading insert. Nothing was written by this
    // call; return the same idempotent shape as a same-day POST.
    return NextResponse.json(alreadyCheckedInResponse(player))
  }

  return NextResponse.json({
    ok: true,
    alreadyCheckedIn: false,
    checkInCount: Number(committed.check_in_count ?? player.check_in_count + 1),
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
    shields: streak.shields,
    shieldsEarned: streak.shieldsEarned,
    bracket: newBracket,
    bracketChanged: newBracket !== currentBracket,
    previousBracket: currentBracket,
    withdrawalDetected: withdrewNow,
    previousBalanceLuna: priorMostRecent,
    balanceLuna: Math.floor(balanceLuna),
    unlockedItems,
    badgeActions,
  })

  // ── helpers defined inside the handler so they close over `db` + `address` ──

  function alreadyCheckedInResponse(row: Record<string, unknown>) {
    const bracket = (row.bracket as Bracket | null) ?? null
    return {
      ok: true,
      alreadyCheckedIn: true,
      checkInCount: Number(row.check_in_count ?? 0),
      awarded: [],
      leveledUp: false,
      newLevel: row.level,
      newXp: row.xp,
      xpToNext: xpToNextLevel(row.level as number),
      streakCurrent: row.streak_current,
      shields: row.shields,
      shieldsEarned: row.shields_earned,
      bracket,
      bracketChanged: false,
      previousBracket: bracket,
      withdrawalDetected: false,
      previousBalanceLuna: null,
      balanceLuna: Number(row.current_balance_luna ?? 0),
      unlockedItems: [],
      badgeActions: [],
    }
  }

  async function dailyXpToday(): Promise<number> {
    const { data } = await db
      .from('daily_xp')
      .select('xp_earned')
      .eq('player_address', address)
      .eq('utc_date', today)
      .maybeSingle()
    return data?.xp_earned ?? 0
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
