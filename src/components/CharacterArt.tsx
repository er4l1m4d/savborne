/**
 * Savborne - character art
 *
 * The handoff's Profile card uses the Hero sprite for the player's bracket.
 * The art is 16x16 and only scales in whole multiples, so the card renders it
 * at 80px (5x) rather than the handoff's 84px, which would soften pixels.
 */

import art from '../../assets/characters.json'
import type { Bracket } from '@/lib/constants'
import type { Avatar } from '@/lib/avatar'

const KEY: Record<Avatar, Record<Bracket, keyof typeof art>> = {
  hero: {
    entry: 'Hero · Entry',
    bronze: 'Hero · Bronze',
    silver: 'Hero · Silver',
    gold: 'Hero · Gold',
  },
  heroine: {
    entry: 'Heroine · Entry',
    bronze: 'Heroine · Bronze',
    silver: 'Heroine · Silver',
    gold: 'Heroine · Gold',
  },
}

export function CharacterArt({
  bracket,
  character = 'hero',
  size = 80,
}: {
  bracket: Bracket | null
  character?: Avatar
  size?: number
}) {
  const key = KEY[character][bracket ?? 'entry']
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      style={{ imageRendering: 'pixelated' }}
    >
      <g dangerouslySetInnerHTML={{ __html: art[key] }} />
    </svg>
  )
}
