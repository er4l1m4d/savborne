/**
 * Savborne - balance-error retry handoff
 *
 * `/balance-error` cannot start the check-in itself: Home owns the POST and the
 * award handling. The error screen leaves a one-shot flag; Home consumes it
 * after the player loads and runs one check-in. A blocked storage API is safe:
 * the write returns false and the player simply taps Check in.
 */

const KEY = 'savborne.balance-retry.v1'

let cached = false

export function writeBalanceRetry(): boolean {
  try {
    window.sessionStorage.setItem(KEY, '1')
    cached = true
    return true
  } catch {
    return false
  }
}

export function takeBalanceRetry(): boolean {
  let stored = false
  try {
    stored = window.sessionStorage.getItem(KEY) === '1'
  } catch {
    // A blocked read is treated as no flag.
  }
  const value = cached || stored
  cached = false
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // Already consumed in memory; the stale storage key is harmless.
  }
  return value
}
