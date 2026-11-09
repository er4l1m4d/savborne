/**
 * Savborne - whether the player has already checked in today
 *
 * The server enforces one check-in per UTC day. The button needs the same
 * boundary, otherwise it stays enabled after midnight or disables early for
 * players outside UTC.
 */

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
