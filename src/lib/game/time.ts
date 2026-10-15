/**
 * Savborne — UTC time helpers
 *
 * All game time runs on UTC (spec 4.7). Never use `Date.now()` results
 * directly for date logic — always go through these helpers so a user's
 * device clock cannot shift the daily/weekly reset boundary.
 *
 * The client sends a "recorded_at" timestamp from the server on check-in;
 * we do not trust a client-supplied date. Server routes call `utcNow()` at
 * the top of every handler and thread it through.
 */

/** A UTC calendar day, ISO `YYYY-MM-DD`. */
export function utcDayOf(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Start of the current UTC day (00:00:00.000Z). */
export function utcDayStart(now: Date): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Start of the current UTC week (Monday 00:00:00.000Z). */
export function utcWeekStart(now: Date): Date {
  const d = utcDayStart(now)
  const dayOfWeek = d.getUTCDay() // 0 = Sun, 1 = Mon, ...
  // Shift back to the Monday on or before today.
  const deltaToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setUTCDate(d.getUTCDate() - deltaToMonday)
  return d
}

/** Whole UTC days between two instants (b - a). Negative if b < a. */
export function utcDaysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000
  return Math.floor((utcDayStart(b).getTime() - utcDayStart(a).getTime()) / MS_PER_DAY)
}

/** Whether two instants fall on the same UTC calendar day. */
export function isSameUtcDay(a: Date, b: Date): boolean {
  return utcDayOf(a) === utcDayOf(b)
}

/** Whether two instants fall in the same UTC week (Mon–Sun). */
export function isSameUtcWeek(a: Date, b: Date): boolean {
  return utcWeekStart(a).getTime() === utcWeekStart(b).getTime()
}

/** Convenience: current UTC instant. */
export function utcNow(): Date {
  return new Date()
}
