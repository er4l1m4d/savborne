/**
 * Savborne - character art choice
 *
 * The two shipped drawings are Hero and Heroine for every bracket. The field is
 * called `avatar` rather than `character` (the SQL type name) or `gender`: it
 * records an art choice, not an identity.
 */

export const AVATARS = ['hero', 'heroine'] as const

export type Avatar = (typeof AVATARS)[number]

export const DEFAULT_AVATAR: Avatar = 'hero'

export function isAvatar(value: unknown): value is Avatar {
  return value === 'hero' || value === 'heroine'
}

export function normaliseAvatar(value: unknown): Avatar {
  return isAvatar(value) ? value : DEFAULT_AVATAR
}
