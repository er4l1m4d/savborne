import type { ReactNode } from 'react'

/**
 * Savborne — 24px status chip
 *
 * Outline for streak / shields / check-ins and bracket names; fill (mint,
 * ground text) for progress such as `Done`.
 */

type ChipProps = {
  variant?: 'outline' | 'fill'
  /** Outline text colour, e.g. a bracket metal. Ignored by `fill`. */
  color?: string
  children: ReactNode
}

export function Chip({ variant = 'outline', color, children }: ChipProps) {
  return (
    <span
      className={`sv-chip sv-chip--${variant}`}
      style={variant === 'outline' && color ? { color } : undefined}
    >
      {children}
    </span>
  )
}
