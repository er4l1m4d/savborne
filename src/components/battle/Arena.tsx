/**
 * Savborne - battle arena
 *
 * One panel owns the two plates, the HP meters and the sprites. The battle
 * screen, the waiting state and the result screen all use it so the layout
 * cannot drift between them.
 */

import type { ReactNode } from 'react'
import { Meter } from '@/components/ui/Meter'
import { PixelPanel } from '@/components/ui/PixelPanel'

export type ArenaStatus = 'your-move' | 'theirs' | 'acted' | 'offline' | 'none'

export type ArenaSide = {
  name: string
  level: number | null
  hp: number
  maxHp: number
  art: ReactNode
  status: ArenaStatus
  /** Applied to the sprite only, e.g. 0.55 for a defeated fighter. */
  opacity?: number
}

type ArenaProps = {
  me: ArenaSide
  opponent: ArenaSide
  variant?: 'battle' | 'result'
  dimmed?: boolean
  tone?: 'default' | 'mint' | 'coral'
}

const STATUS_LABEL: Record<ArenaStatus, string | null> = {
  'your-move': 'YOUR MOVE',
  theirs: 'THEIRS',
  acted: 'ACTED',
  offline: 'OFFLINE',
  none: null,
}

function statusColor(status: ArenaStatus): string {
  if (status === 'offline') return 'var(--coral-text)'
  if (status === 'your-move') return 'var(--fg-soft)'
  return 'var(--fg-muted)'
}

function plateBorder(status: ArenaStatus): string {
  if (status === 'your-move') return 'border-4 border-bevel'
  if (status === 'acted') return 'border-2 border-dashed border-bevel-soft'
  if (status === 'offline') return 'border-2 border-coral'
  return 'border-2 border-bevel'
}

function Plate({
  side,
  position,
  self,
}: {
  side: ArenaSide
  position: string
  self: boolean
}) {
  const label = STATUS_LABEL[side.status]
  return (
    <div
      className={`absolute ${position} flex w-[46%] max-w-[168px] flex-col gap-1.5 bg-background px-3 py-2.5 ${plateBorder(side.status)}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="sv-label min-w-0 flex-1 truncate text-fg" title={side.name}>
          {side.name}
        </span>
        {side.level !== null && (
          <span className="sv-label shrink-0 text-fg-muted">Lv {side.level}</span>
        )}
      </div>
      {label && (
        <span
          className="sv-section-label"
          style={{ color: statusColor(side.status) }}
        >
          {label}
        </span>
      )}
      <Meter value={side.hp} max={side.maxHp} tone={self ? 'mint' : 'coral'} />
      <span className="sv-label text-fg-muted">
        {side.hp} / {side.maxHp} HP
      </span>
    </div>
  )
}

export function Arena({ me, opponent, variant = 'battle', dimmed, tone = 'default' }: ArenaProps) {
  const result = variant === 'result'
  const selfArt = result
    ? 'absolute bottom-[36px] left-[66px]'
    : 'absolute bottom-[40px] left-[30px]'
  const opponentArt = result
    ? 'absolute bottom-[32px] right-[60px]'
    : 'absolute right-[30px] top-[20px]'

  return (
    <PixelPanel
      tone={tone}
      className={`relative overflow-hidden p-0 ${
        result ? 'h-[250px]' : 'h-[380px] min-[390px]:h-[410px]'
      }`}
    >
      <div className={dimmed ? 'opacity-55' : ''}>
        <Plate side={opponent} position="left-3 top-3" self={false} />
        <Plate side={me} position="right-3 bottom-3" self />
        <div
          className={opponentArt}
          style={{ opacity: opponent.opacity ?? 1, transform: 'scaleX(-1)' }}
          aria-hidden
        >
          {opponent.art}
        </div>
        <div className={selfArt} style={{ opacity: me.opacity ?? 1 }} aria-hidden>
          {me.art}
        </div>
      </div>
    </PixelPanel>
  )
}
