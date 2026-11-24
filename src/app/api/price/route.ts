import { NextResponse } from 'next/server'
import { SUPPORTED_FIATS, type FiatCode } from '@/lib/fiat'

/**
 * Savborne — NIM price
 *
 * Server-side on purpose: the price is public, but the request is not the
 * player's, so nothing about who is saving what leaves the app to reach a third
 * party. The result is cached in module memory for a minute, which is enough for
 * a headline number and keeps us inside the source's rate limit when more than
 * one player opens the app at once.
 *
 * Failure is a 502 and no cache entry. The UI hides the fiat line when the rate
 * is unavailable; it never falls back to a stale or invented number.
 */

const SOURCE = 'https://api.coingecko.com/api/v3/simple/price'
const TTL_MS = 60_000

let cache: { at: number; rates: Partial<Record<FiatCode, number>> } | null = null

export const dynamic = 'force-dynamic'

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ rates: cache.rates, cached: true })
  }

  try {
    const url = `${SOURCE}?ids=nimiq-2&vs_currencies=${SUPPORTED_FIATS.join(',').toLowerCase()}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`price source ${res.status}`)

    const payload = (await res.json()) as { 'nimiq-2'?: Record<string, unknown> }
    const quoted = payload['nimiq-2']
    if (!quoted || typeof quoted.usd !== 'number') throw new Error('no usd quote')

    const rates: Partial<Record<FiatCode, number>> = {}
    for (const code of SUPPORTED_FIATS) {
      const value = quoted[code.toLowerCase()]
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        rates[code] = value
      }
    }
    if (!rates.USD) throw new Error('no usd quote')

    cache = { at: now, rates }
    return NextResponse.json({ rates })
  } catch {
    // No cache write: a failed refresh should not pin a bad minute in place.
    return NextResponse.json({ error: 'Price unavailable' }, { status: 502 })
  }
}
