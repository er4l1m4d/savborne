/**
 * POST /api/session
 *
 * Exchange a fresh wallet signature for a 12-hour stateless session token.
 * This is the only unauthenticated identity endpoint: a wallet that has never
 * onboarded can call it, which is exactly what onboarding needs before it
 * creates a player row.
 *
 * Body: { address, signedAt, publicKey, signature }
 * 200:  { token, expiresAt, address }
 * 400:  { error: 'malformed' | 'invalid_address' }
 * 401:  { error: 'stale' | 'bad_signature' | 'wrong_signer' }
 * 429:  { error: 'rate_limited', retryAfterSeconds }
 *
 * The proof is checked before any database read. The rate limit is per client
 * IP, before the proof, so a script cannot use this endpoint as a signature
 * oracle for free.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isPlausibleAddress, normalizeAddress } from '@/lib/vault/address'
import { readSessionProof } from '@/lib/session-request'
import { verifySessionSignature } from '@/lib/session-verify'
import { issueSessionToken } from '@/lib/session-token'
import { clientIp, rateLimitOrError } from '@/lib/rate-limit'
import { routeError } from '@/lib/report'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RATE_LIMIT = { limit: 20, windowSeconds: 60 }

export async function POST(req: Request) {
  const limited = await rateLimitOrError({
    req,
    route: '/api/session',
    key: `session:${clientIp(req)}`,
    ...RATE_LIMIT,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'malformed' }, { status: 400 })
  }

  const address = (body as { address?: unknown } | null)?.address
  if (typeof address !== 'string' || !isPlausibleAddress(address)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 })
  }

  const proof = readSessionProof(body, Date.now())
  if (!proof.ok) {
    return NextResponse.json(
      { error: proof.reason },
      { status: proof.reason === 'malformed' ? 400 : 401 },
    )
  }

  let verified
  try {
    verified = await verifySessionSignature({ address, proof: proof.proof })
  } catch (error) {
    return routeError({
      req,
      route: '/api/session',
      code: 'verification_failed',
      status: 500,
      error,
    })
  }
  if (!verified.ok) {
    return NextResponse.json(
      { error: verified.reason },
      { status: verified.reason === 'malformed' ? 400 : 401 },
    )
  }

  try {
    const { token, expiresAt, sessionId } = issueSessionToken(address)
    // Persist the revocable row before handing out the token. If this write
    // fails, no token is returned.
    const { error: insertErr } = await supabaseAdmin()
      .from('player_sessions')
      .insert({
        id: sessionId,
        player_address: address.trim(),
        expires_at: new Date(expiresAt).toISOString(),
      })
    if (insertErr) {
      return routeError({
        req,
        route: '/api/session',
        code: 'db_error',
        status: 500,
        error: insertErr,
      })
    }

    return NextResponse.json({
      token,
      expiresAt,
      address: normalizeAddress(address),
    })
  } catch (error) {
    return routeError({
      req,
      route: '/api/session',
      code: 'session_unavailable',
      status: 503,
      error,
    })
  }
}

/**
 * DELETE /api/session
 *
 * Revoke the current session, or every session for the player with `?all=1`.
 * The caller must already hold a live session. Disconnect uses `all=1` so a
 * token stolen from another device dies when the owner signs out.
 */
export async function DELETE(req: Request) {
  const auth = await requirePlayer(req)
  if (isAuthResponse(auth)) return auth

  const all = new URL(req.url).searchParams.get('all') === '1'
  const db = supabaseAdmin()
  const now = new Date().toISOString()

  let query = db
    .from('player_sessions')
    .update({ revoked_at: now })
    .eq('player_address', auth.address)
    .is('revoked_at', null)
  if (!all) query = query.eq('id', auth.sessionId)

  const { error } = await query
  if (error) {
    return routeError({
      req,
      route: '/api/session',
      code: 'db_error',
      status: 500,
      error,
    })
  }

  return NextResponse.json({ ok: true, revoked: all ? 'all' : 'current' })
}
