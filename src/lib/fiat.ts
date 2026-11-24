/**
 * Savborne — fiat display
 *
 * A number of NIM means little to someone who has not internalised the rate.
 * Nimiq Pay already knows which currency a person uses, so the vault balance can
 * be shown in money they actually think in.
 *
 * Two constraints shape this file:
 *
 * - The host can hand back a currency we cannot price. The SDK's own enum is
 *   USD, EUR, CRC and GMD, and the price source quotes three of those, so GMD
 *   resolves to USD rather than to an invented rate.
 * - NIM trades in fractions of a cent. A vault holding 12 NIM is worth less than
 *   one cent, and "≈ $0.00" is worse than saying nothing at all, so values under
 *   a cent render nothing. The feature appears when it has something to say.
 */

export const SUPPORTED_FIATS = ['USD', 'EUR', 'CRC'] as const

export type FiatCode = (typeof SUPPORTED_FIATS)[number]

/** Below this, the converted value is noise: hide it. */
export const MIN_DISPLAY_FIAT = 0.01

/**
 * Map whatever the host reports onto a currency we can actually quote.
 * Unknown, missing or malformed values fall back to USD, which every price
 * source carries.
 */
export function resolveFiat(raw: unknown): FiatCode {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  return (SUPPORTED_FIATS as readonly string[]).includes(code) ? (code as FiatCode) : 'USD'
}

/**
 * NIM → fiat, or null when there is nothing worth showing (no rate yet, a
 * nonsensical rate, or a value under a cent).
 */
export function fiatValue(nim: number, rate: number | null | undefined): number | null {
  if (!Number.isFinite(nim) || nim <= 0) return null
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null
  const value = nim * rate
  return value >= MIN_DISPLAY_FIAT ? value : null
}

/** Two decimals, the currency's own symbol, grouped by the browser's rules. */
export function formatFiat(value: number, code: FiatCode): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
