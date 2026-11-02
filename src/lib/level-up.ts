/**
 * Savborne — level-up detection
 *
 * The game reports a level change, but three mounted components (the tabs
 * layout, Home and Profile) each hold their own `usePlayerSession`, so a naive
 * component-level check would celebrate the same level three times.
 *
 * The observation map lives at module scope on purpose: it is shared by every
 * hook instance, and a level is only ever announced once. It also suppresses a
 * replay when a screen remounts at an unchanged level, and stays silent on the
 * first observation — loading the app at Level 5 is not a level-up.
 *
 * Pure state, no browser APIs, so the behaviour is unit-testable.
 */

const reportedLevel = new Map<string, number>()

/**
 * Record the latest known level for a player and report whether this
 * observation is a genuine increase. Returns `false` on the first sighting.
 */
export function observeLevel(address: string, level: number): boolean {
  const previous = reportedLevel.get(address)
  const increased = previous !== undefined && level > previous
  reportedLevel.set(address, level)
  return increased
}

/** Test-only: clear the module-scope memory between cases. */
export function resetObservedLevels(): void {
  reportedLevel.clear()
}
