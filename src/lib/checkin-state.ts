/**
 * Savborne - whether the player has already checked in today
 *
 * The server enforces one check-in per UTC day. The button needs the same
 * boundary, otherwise it stays enabled after midnight or disables early for
 * players outside UTC.
 */

import { utcDayStart } from './game/time'

const MS_PER_DAY = 86_400_000

/**
 * How close to the end of the UTC day the streak cue appears. The final hours
 * only: a countdown that runs all day is a nag, not information.
 */
export const STREAK_RISK_WINDOW_MS = 6 * 60 * 60 * 1000

export function checkedInToday(lastCheckInAt: string | null, now = new Date()): boolean {
  if (!lastCheckInAt) return false
  const last = new Date(lastCheckInAt)
  if (Number.isNaN(last.getTime())) return false
  return (
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate()
  )
}

/**
 * Milliseconds left before the UTC day ends while a live streak is unclaimed,
 * or null when there is nothing to warn about: already checked in today, no
 * streak, or more than the final-hours window left.
 *
 * A shield holder still gets the cue - a missed day is bridged by spending a
 * shield at the next check-in, so the day only ends "safe" once it is claimed.
 */
export function streakAtRisk(
  streakCurrent: number,
  lastCheckInAt: string | null,
  now = new Date(),
  windowMs = STREAK_RISK_WINDOW_MS,
): number | null {
  if (streakCurrent <= 0) return null
  if (checkedInToday(lastCheckInAt, now)) return null
  const msLeft = utcDayStart(now).getTime() + MS_PER_DAY - now.getTime()
  if (msLeft <= 0 || msLeft > windowMs) return null
  return msLeft
}

/** `5h 12m` for a countdown; minutes only below an hour. No periods. */
export function formatHoursMinutes(msLeft: number): string {
  const totalMinutes = Math.floor(msLeft / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
