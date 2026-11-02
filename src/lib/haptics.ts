/**
 * Savborne — haptics
 *
 * One guarded wrapper over `navigator.vibrate`. Called only alongside the
 * level-up arpeggio, never on ordinary taps: a phone that buzzes on every
 * button is a phone people mute.
 */

export function buzz(pattern: number | number[] = 40): void {
  try {
    if (typeof navigator === 'undefined') return
    if (typeof navigator.vibrate !== 'function') return
    navigator.vibrate(pattern)
  } catch {
    // Unsupported or blocked: no vibration, no error.
  }
}
