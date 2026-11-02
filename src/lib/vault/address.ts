/**
 * Savborne — Nimiq address normalisation
 *
 * User-friendly addresses are uppercase, space-separated and case-insensitive.
 * Raw string equality is wrong; every comparison goes through `sameAddress`.
 *
 * `isPlausibleAddress` is a shape check for input validation only. It is not
 * an authorisation check: anyone can type any well-formed address. Ownership is
 * established by the chain (a signed transfer) or by the vault mapping.
 */

/** Strip spaces (and stray `+` separators) and uppercase. */
export function normalizeAddress(address: string): string {
  return address.replace(/[\s+]/g, '').toUpperCase()
}

export function sameAddress(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b)
}

/** NQ + 34 base32 characters, spaces ignored. */
export function isPlausibleAddress(value: unknown): value is string {
  return typeof value === 'string' && /^NQ[0-9A-Z]{34}$/.test(normalizeAddress(value))
}

/** `NQ07 0000 … 6666 7777` — first and last `groups` groups of four. */
export function shortenAddress(address: string, groups = 2): string {
  const parts = normalizeAddress(address).match(/.{4}/g) ?? []
  if (parts.length <= groups * 2) return parts.join(' ')
  return `${parts.slice(0, groups).join(' ')} … ${parts.slice(-groups).join(' ')}`
}
