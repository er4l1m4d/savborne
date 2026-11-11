/**
 * Savborne - NIM string to Luna, without floating point.
 *
 * `Number('1.005') * 100_000` is 100499.99999999999, and `Math.floor` turns a
 * valid 2dp withdrawal into one luna less than the player asked for. Parsing
 * the digits as integers avoids that class of bug entirely.
 */

const LUNA_PER_NIM = 100_000

/**
 * Parse a decimal NIM string to integer Luna. Returns null for malformed
 * input, more decimal places than allowed, zero, or a value beyond the safe
 * integer range. Never rounds silently.
 */
export function parseNimToLuna(value: string, maxDecimals = 5): number | null {
  const trimmed = value.trim()
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null

  const [wholeRaw, fractionRaw = ''] = trimmed.split('.')
  if (fractionRaw.length > maxDecimals) return null

  const whole = BigInt(wholeRaw || '0')
  const fraction = BigInt(fractionRaw.padEnd(5, '0').slice(0, 5) || '0')
  const luna = whole * BigInt(LUNA_PER_NIM) + fraction

  if (luna <= 0n) return null
  if (luna > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(luna)
}
