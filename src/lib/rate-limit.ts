/**
 * Savborne - fixed-window abuse limits for API routes.
 *
 * One helper so every route returns the same denial shape and a `Retry-After`
 * header. Keys are built by the caller: authenticated routes use the session
 * address, unauthenticated routes use the first `x-forwarded-for` hop (Vercel
 * sets it) with a stable fallback.
 *
 * A missing rate-limit RPC is a 500 `db_error`, matching check-in. Silently
 * allowing traffic when the guard is broken would make the limit advisory.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'
import { routeError } from './report'

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number }

/** First forwarded hop, or a stable bucket when no proxy header exists. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first && first.length <= 64 ? first : 'unknown'
}

export async function takeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision> {
  const db = supabaseAdmin()
  const { data, error } = await db.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) throw error

  const row = (data ?? {}) as { allowed?: unknown; remaining?: unknown; retryAfterSeconds?: unknown }
  if (row.allowed === false) {
    return {
      allowed: false,
      retryAfterSeconds: Number(row.retryAfterSeconds ?? windowSeconds),
    }
  }
  return { allowed: true, remaining: Number(row.remaining ?? 0) }
}

/**
 * Run the limit and return a ready-to-send denial, or null to continue.
 * The route name is used only for the structured error log.
 */
export async function rateLimitOrError(args: {
  req: Request
  route: string
  key: string
  limit: number
  windowSeconds: number
}): Promise<Response | null> {
  let decision: RateLimitDecision
  try {
    decision = await takeRateLimit(args.key, args.limit, args.windowSeconds)
  } catch (error) {
    return routeError({
      req: args.req,
      route: args.route,
      code: 'db_error',
      status: 500,
      error,
    })
  }

  if (decision.allowed) return null

  const retryAfter = Number.isFinite(decision.retryAfterSeconds)
    ? decision.retryAfterSeconds
    : args.windowSeconds
  return NextResponse.json(
    { error: 'rate_limited', retryAfterSeconds: retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
