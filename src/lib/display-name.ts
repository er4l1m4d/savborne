/**
 * Savborne - display-name rules
 *
 * New names are capped at 16 characters, matching the handoff. The database
 * check stays 1-32 so names created before this batch remain valid; there is no
 * rename path, so this module only gates creation.
 */

export const DISPLAY_NAME_MAX = 16

export function normaliseDisplayName(raw: string): string {
  return raw.trim()
}

export type DisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; error: string }

export function validateDisplayName(raw: string): DisplayNameResult {
  const value = normaliseDisplayName(raw)
  if (value.length < 1 || value.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: 'Display name must be 1-16 characters.' }
  }
  return { ok: true, value }
}
