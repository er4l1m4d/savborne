/**
 * Savborne - rival art
 *
 * The four rivals ship in assets/characters.json. They are 16x16 pixel art and
 * scale in whole multiples only, so the arena uses 96px (6x) and the menu card
 * uses 32px (2x). The visible name carries the meaning; the art is decorative.
 */

import art from '../../assets/characters.json'
import type { RivalKey } from '@/lib/game/rivals'

export function RivalArt({ rival, size = 96 }: { rival: RivalKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      style={{ imageRendering: 'pixelated' }}
    >
      <g dangerouslySetInnerHTML={{ __html: art[rival] }} />
    </svg>
  )
}
