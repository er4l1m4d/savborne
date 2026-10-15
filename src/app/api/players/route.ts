/**
 * POST /api/players
 *
 * Creates the player row at the end of onboarding. Idempotent: if the same
 * address is submitted again with the same savings account, we return the
 * existing record so a user can re-consent or reload without duplicates.
 *
 * Body:
 *   {
 *     address:           string   // the player's Nimiq address (identity key)
 *     savingsAddress:    string   // the connected savings account address
 *     displayName:       string   // 1–32 chars, shown on leaderboard
 *     initialBalanceLuna: number  // client-supplied first read; server does not re-fetch
 *   }
 *
 * Response:
 *   201 { player: PlayerRow, created: true }
 *   200 { player: PlayerRow, created: false }  // already existed, idempotent
 *   400 { error }                              // bad inputs
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { bracketFromLuna } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  address?: unknown
  savingsAddress?: unknown
  displayName?: unknown
  initialBalanceLuna?: unknown
}

const ADDRESS_RE = /^[NQ][A-Za-z0-9]{10,}$/

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { address, savingsAddress, displayName, initialBalanceLuna } = body

  if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid player address' }, { status: 400 })
  }
  if (typeof savingsAddress !== 'string' || !ADDRESS_RE.test(savingsAddress)) {
    return NextResponse.json({ error: 'Invalid savings address' }, { status: 400 })
  }
  if (
    typeof displayName !== 'string' ||
    displayName.trim().length < 1 ||
    displayName.trim().length > 32
  ) {
    return NextResponse.json({ error: 'Display name must be 1–32 characters' }, { status: 400 })
  }
  if (typeof initialBalanceLuna !== 'number' || !Number.isFinite(initialBalanceLuna)) {
    return NextResponse.json({ error: 'Initial balance must be a number of Luna' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Idempotency: if a row already exists for this address, return it.
  const existing = await db.from('players').select('*').eq('address', address).maybeSingle()
  if (existing.data) {
    return NextResponse.json({ player: existing.data, created: false })
  }

  const insert = {
    address,
    savings_account_address: savingsAddress,
    display_name: displayName.trim(),
    current_balance_luna: Math.floor(initialBalanceLuna),
    bracket: bracketFromLuna(initialBalanceLuna),
    level: 1,
    xp: 0,
    rating: 1000,
    check_in_count: 0,
    streak_current: 0,
    streak_best: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    grace_used_this_week: false,
    withdrawal_in_progress: false,
    steady_hand_started_at: new Date().toISOString(),
  }

  const { data, error } = await db.from('players').insert(insert).select().single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ player: data, created: true }, { status: 201 })
}
