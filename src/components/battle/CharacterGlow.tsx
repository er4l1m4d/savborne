/**
 * Savborne - battle glow rim
 *
 * The gilt silhouette rim that says "an effect has been applied to this
 * fighter" (art bible §4): defend and item-use, identically. The rims are
 * pre-baked 8-neighbour outlines, one pixel wide in #FEE761, shipped per
 * character in assets/character-glows.json - a CSS drop-shadow would blur,
 * and blur breaks the quantised idiom the whole motion set holds.
 *
 * Drawn on the same 16x16 grid as the sprite and at the same size, so the
 * overlay lands pixel-perfect over it. Visibility is the caller's state
 * (`.sv-glow`, data-on); this component only draws.
 */

import glows from '../../../assets/character-glows.json'
import type { Avatar } from '@/lib/avatar'
import type { Bracket } from '@/lib/constants'
import type { RivalKey } from '@/lib/game/rivals'

export type GlowKey = keyof typeof glows

/** Mirror of CharacterArt's KEY map: every player sprite has a rim. */
const HERO_KEY: Record<Avatar, Record<Bracket, GlowKey>> = {
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

/** The rim key for a player sprite. Human opponents render the default hero
 * gear (their avatar is not in the battle payload), so both sides use this. */
export function heroGlowKey(bracket: Bracket | null, character: Avatar): GlowKey {
  return HERO_KEY[character][bracket ?? 'entry']
}

/** The rim key for a rival: the rival names are the art keys themselves. */
export function rivalGlowKey(rival: RivalKey): GlowKey {
  return rival
}

export function CharacterGlow({ glowKey, size }: { glowKey: GlowKey; size: number }) {
  const markup = glows[glowKey]
  if (!markup) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      style={{ imageRendering: 'pixelated' }}
    >
      <g dangerouslySetInnerHTML={{ __html: markup }} />
    </svg>
  )
}
