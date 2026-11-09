/**
 * Savborne — Missions screen helpers
 *
 * The screen shows a period counter in each group header, e.g.
 * "10 of 25 XP". The caps come from `GET /api/missions`; the earned figure is
 * the sum of the completed rows in the group, clamped to the cap. The weekly
 * API counter is a check-in count (see the route comment), so it is not used.
 * Caps equal the sum of the period's rewards, so the two agree in normal play.
 */

export function earnedXp(
  missions: { completed: boolean; xpReward: number }[],
  cap: number,
): number {
  const total = missions.reduce((sum, m) => sum + (m.completed ? m.xpReward : 0), 0)
  return cap > 0 ? Math.min(cap, total) : total
}

export function xpCounter(earned: number, cap: number): string {
  return `${earned} of ${cap} XP`
}
