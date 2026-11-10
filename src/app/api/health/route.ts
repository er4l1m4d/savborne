/**
 * GET /api/health
 *
 * A cheap, public, secret-free readiness probe for uptime monitoring and the
 * release checklist. It answers one question: can this deployment trust the
 * database it is pointed at?
 *
 * Checks:
 *   db            - PostgREST answered at all (network + credentials)
 *   checkInRpc    - `commit_check_in` exists in `public`
 *   rateLimitRpc  - `consume_rate_limit` exists in `public`
 *
 * 200 only when the database's `schema_health()` version equals this build's
 * EXPECTED_SCHEMA_VERSION and both RPCs exist. Anything else is 503 with
 * `ok:false`, never a raw Postgres or PostgREST message.
 *
 * This route intentionally returns no player data, no environment values and
 * no error text. It is safe to expose publicly and to poll every 15 minutes.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { EXPECTED_SCHEMA_VERSION, type SchemaHealthRow } from '@/lib/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type HealthBody = {
  ok: boolean
  schemaVersion: string | null
  expectedSchemaVersion: string
  checks: {
    db: boolean
    checkInRpc: boolean
    rateLimitRpc: boolean
  }
}

export async function GET() {
  const checks: HealthBody['checks'] = {
    db: false,
    checkInRpc: false,
    rateLimitRpc: false,
  }
  let schemaVersion: string | null = null

  try {
    const db = supabaseAdmin()
    const { data, error } = await db.rpc('schema_health')

    if (error) {
      // PostgREST answered with an error code, so the database is reachable
      // even though the health contract is not installed. A thrown fetch is
      // the only path that leaves `db` false.
      checks.db = Boolean(error.code)
    } else {
      checks.db = true
      const row = (data ?? {}) as Partial<SchemaHealthRow>
      schemaVersion = typeof row.version === 'string' ? row.version : null
      checks.checkInRpc = row.commitCheckIn === true
      checks.rateLimitRpc = row.consumeRateLimit === true
    }
  } catch {
    // Missing env or an unreachable host: keep every check false. The error is
    // deliberately not echoed; monitoring only needs the boolean.
  }

  const ok =
    checks.db &&
    checks.checkInRpc &&
    checks.rateLimitRpc &&
    schemaVersion === EXPECTED_SCHEMA_VERSION

  const body: HealthBody = {
    ok,
    schemaVersion,
    expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    checks,
  }

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  })
}
