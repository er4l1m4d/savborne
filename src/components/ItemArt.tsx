/**
 * Savborne - item art
 *
 * The handoff ships 16x16 pixel placeholders for all eight items. They render
 * at whole multiples only (48px = 3x), so the grid stays crisp. The visible
 * item name carries the meaning; the art is decorative here.
 */

import art from '../../assets/items.json'
import type { ItemKey } from '@/lib/game/items'

const ASSET_NAME: Record<ItemKey, keyof typeof art> = {
  cloth_purse: 'Cloth Purse',
  ledger_scroll: 'Ledger Tome',
  bronze_shield: 'Bronze Shield',
  copper_compass: 'Copper Compass',
  silver_blade: 'Silver Blade',
  silver_charm: 'Silver Charm',
  gold_gauntlet: 'Gold Gauntlet',
  golden_crown: 'Golden Crown',
}

export function ItemArt({ item, size = 48 }: { item: ItemKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      style={{ imageRendering: 'pixelated' }}
    >
      <g dangerouslySetInnerHTML={{ __html: art[ASSET_NAME[item]] }} />
    </svg>
  )
}
