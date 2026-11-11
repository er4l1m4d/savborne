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
import { isPlausibleAddress, normalizeAddress } from '@/lib/vault/address'
import { readSessionProof } from '@/lib/session-request'
import { verifySessionSignature } from '@/lib/session-verify'
import { issueSessionToken } from '@/lib/session-token'
import { clientIp, rateLimitOrError } from '@/lib/rate-limit'
import { routeError } from '@/lib/report'

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
    const { token, expiresAt } = issueSessionToken(address)
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
