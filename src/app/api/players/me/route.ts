/**
 * GET /api/players/me
 *
 * Returns the current player's state for the home screen: identity, level,
 * XP, bracket, streak, current balance, and how much XP is needed for the
 * next level. Reads are trusted because RLS allows anyone to select the
 * public columns; here we still gate by the address header so a caller
 * cannot enumerate other players' rows through this endpoint.
 *
 * PATCH changes the chosen Hero/Heroine drawing only. It is the one profile
 * field a player may change after onboarding.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAvatar } from '@/lib/avatar'
import { xpToNextLevel } from '@/lib/constants'
import { utcDayOf } from '@/lib/game/time'
import { weeklyMissionXp } from '@/lib/game/weekly-missions'
import { readDeleteProof } from '@/lib/delete-request'
import { verifyDeleteSignature } from '@/lib/delete-verify'
import { routeError } from '@/lib/report'
import { rateLimitOrError } from '@/lib/rate-limit'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address

  const db = supabaseAdmin()
  const now = new Date()
  const today = utcDayOf(now)

  const [{ data: player, error: playerErr }, { data: daily }, weeklyXp, { data: battleRow }, { data: vault }] =
    await Promise.all([
      db.from('players').select('*').eq('address', address).maybeSingle(),
      db.from('daily_xp').select('xp_earned').eq('player_address', address).eq('utc_date', today).maybeSingle(),
      weeklyMissionXp(db, address, now),
      db.from('daily_battles').select('count').eq('player_address', address).eq('utc_date', today).maybeSingle(),
      db.from('vaults').select('address').eq('player_address', address).maybeSingle(),
    ])

  if (playerErr) {
    return routeError({
      req, route: '/api/players/me', code: 'db_error', status: 500, error: playerErr,
    })
  }
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  // Exact weekly mission XP, shared with the missions endpoint and settlement.
  const weeklyXpEarned = weeklyXp

  return NextResponse.json({
    player: {
      address: player.address,
      displayName: player.display_name,
      avatar: player.avatar,
      savingsAddress: player.savings_account_address,
      // Canonical ISO-8601. The delete proof signs this exact string, so the
      // client must not reformat it.
      createdAt: new Date(player.created_at).toISOString(),
      level: player.level,
      xp: player.xp,
      xpToNext: xpToNextLevel(player.level),
      bracket: player.bracket,
      balanceLuna: Number(player.current_balance_luna),
      streakCurrent: player.streak_current,
      streakBest: player.streak_best,
      shields: player.shields,
      shieldsEarned: player.shields_earned,
      hasVault: vault !== null,
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

/**
 * DELETE /api/players/me
 *
 * Permanently removes the caller's account and every row that belongs to it.
 * The on-chain vault is untouched — the 24-word phrase still controls any NIM
 * there. The client only calls this after the player has proved they hold that
 * phrase (see `src/lib/account-deletion.ts`).
 *
 * Because the previous API assumption was "the header is the identity", a
 * bare address header is not enough for an irreversible delete. The caller
 * must also sign a message naming this address and this account's creation
 * time with the key that controls the address. See `delete-verify.ts`.
 *
 * Idempotent: deleting an already-deleted account returns `{ deleted: false }`
 * rather than a 404, so a retry after a dropped response is safe.
 */
export async function DELETE(req: Request) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address

  const proof = readDeleteProof(req.headers, Date.now())
  if (!proof.ok) {
    return NextResponse.json(
      { error: proof.reason },
      { status: proof.reason === 'malformed' ? 400 : 401 },
    )
  }

  const db = supabaseAdmin()

  // The message binds the account's creation time, so the server must read the
  // stored value rather than trust anything the client sends.
  const { data: player, error: playerErr } = await db
    .from('players')
    .select('created_at')
    .eq('address', address)
    .maybeSingle()

  if (playerErr) {
    return routeError({
      req, route: '/api/players/me', code: 'db_error', status: 500, error: playerErr,
    })
  }
  // Nothing to delete. Stay idempotent and skip the destructive call.
  if (!player) {
    return NextResponse.json({ deleted: false, battles: 0 })
  }

  const createdAt = new Date(player.created_at).toISOString()

  let verified
  try {
    verified = await verifyDeleteSignature({ address, createdAt, proof: proof.proof })
  } catch (err) {
    return routeError({
      req, route: '/api/players/me', code: 'verification_failed', status: 500, error: err,
    })
  }
  if (!verified.ok) {
    return NextResponse.json(
      { error: verified.reason },
      { status: verified.reason === 'malformed' ? 400 : 401 },
    )
  }

  const { data, error } = await db.rpc('delete_player', { p_address: address })

  if (error) {
    return routeError({
      req, route: '/api/players/me', code: 'db_error', status: 500, error,
    })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/players/me
 *
 * Body: { avatar: 'hero' | 'heroine' }
 * Response: 200 { avatar }, 400, 401, 404, 500.
 */
export async function PATCH(req: Request) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth
  const address = auth.address

  let body: { avatar?: unknown }
  try {
    body = (await req.json()) as { avatar?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!isAvatar(body.avatar)) {
    return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 })
  }

  const limited = await rateLimitOrError({
    req,
    route: '/api/players/me',
    key: `profile-update:${address}`,
    limit: 20,
    windowSeconds: 60,
  })
  if (limited) return limited

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('players')
    .update({ avatar: body.avatar })
    .eq('address', address)
    .select('avatar')
    .maybeSingle()

  if (error) {
    return routeError({
      req, route: '/api/players/me', code: 'db_error', status: 500, error,
    })
  }
  if (!data) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }
  return NextResponse.json({ avatar: data.avatar })
}
