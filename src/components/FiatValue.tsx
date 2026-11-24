'use client'

/**
 * Savborne — fiat value of a NIM amount
 *
 * Shows "≈ $1.85" under a balance, in the currency the person set in Nimiq Pay.
 *
 * Renders nothing at all when it has nothing trustworthy to show: no rate yet,
 * the price service is down, or the amount converts to under a cent. That is
 * deliberate. A savings app that prints "$0.00" under someone's balance is
 * telling them their saving is worthless; silence says less and costs less.
 *
 * The rate is fetched once per page load and shared, so a screen with several
 * balances does not ask twice.
 */

import { useEffect, useState } from 'react'
import { fiatValue, formatFiat, resolveFiat, type FiatCode } from '@/lib/fiat'
import { hostFiat } from '@/lib/nimiq-host'

type Rates = Partial<Record<FiatCode, number>>

let ratePromise: Promise<Rates | null> | null = null

function loadRates() {
  ratePromise ??= fetch('/api/price', { headers: { accept: 'application/json' } })
    .then(async (res) => (res.ok ? ((await res.json()).rates as Rates) : null))
    .catch(() => null)
  return ratePromise
}

export function FiatValue({
  nim,
  className,
}: {
  /** The NIM amount, not luna. */
  nim: number
  className?: string
}) {
  const [rates, setRates] = useState<Rates | null>(null)

  useEffect(() => {
    let cancelled = false
    loadRates().then((next) => {
      if (!cancelled) setRates(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // First paint on both server and client has no rates, so this returns the same
  // nothing in both places and cannot mis-hydrate.
  if (!rates) return null

  const code = resolveFiat(hostFiat())
  const value = fiatValue(nim, rates[code])
  if (value === null) return null

  return <span className={className}>≈ {formatFiat(value, code)}</span>
}
