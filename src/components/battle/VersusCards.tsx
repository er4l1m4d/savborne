/**
 * Savborne - versus cards
 *
 * Two fighter cards and a VS label, shared by the ranked queue and the friend
 * challenge screen. The caller supplies the art: `CharacterArt` for a known
 * player, `RivalArt` for an AI, or `UnknownFighter` for an empty seat.
 */

import type { ReactNode } from 'react'
import { PixelPanel } from '@/components/ui/PixelPanel'

export type VersusSide = {
  name: string
  meta: string
  art: ReactNode
}

type VersusCardsProps = {
  me: VersusSide
  opponent: VersusSide
  height?: 230 | 250
}

function Side({ side, height }: { side: VersusSide; height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2.5 text-center"
      style={{ height }}
    >
      {side.art}
      <span className="sv-subheading sv-break">{side.name}</span>
      <span className="sv-label text-fg-muted">{side.meta}</span>
    </div>
  )
}

export function VersusCards({ me, opponent, height = 250 }: VersusCardsProps) {
  return (
    <div className="flex items-stretch gap-3">
      <PixelPanel tone="mint" wrapperClassName="min-w-0 flex-1" className="h-full p-3">
        <Side side={me} height={height} />
      </PixelPanel>
      <span className="self-center sv-subheading text-fg-muted" aria-hidden>
        VS
      </span>
      <PixelPanel tone="off" wrapperClassName="min-w-0 flex-1" className="h-full p-3">
        <Side side={opponent} height={height} />
      </PixelPanel>
    </div>
  )
}

/** The empty seat shown before a match or a friend accepts. */
export function UnknownFighter({ size = 64 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex items-center justify-center font-extrabold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.9), color: 'var(--off)' }}
    >
      ?
    </span>
  )
}
