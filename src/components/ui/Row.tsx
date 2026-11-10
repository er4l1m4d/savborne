import type { ReactNode } from 'react'

/**
 * Savborne — grouped-list row
 *
 * The parent `PixelPanel` supplies horizontal padding; a `Row` supplies the
 * 58px (or 56px rank) rhythm and the divider. The title column is `min-w-0` so
 * long names wrap instead of pushing the trailing figure off-screen.
 *
 * `variant="you"` is the handoff's caller row: 60px, mint top and bottom
 * borders, no top gap and a 4px bottom gap, and a 14px inline bleed that
 * reaches the panel's padding edge. It matches a `px-3.5` panel. The variant
 * owns both borders, so it never takes `sv-row--56` or `sv-row--divider`.
 */

type RowProps = {
  leading?: ReactNode
  trailing?: ReactNode
  divider?: boolean
  minHeight?: 56 | 58
  /** `you` draws the mint-bordered caller row; `default` is the list row. */
  variant?: 'default' | 'you'
  /** Extra classes on the row itself, e.g. a gap override. */
  className?: string
  children: ReactNode
}

export function Row({
  leading,
  trailing,
  divider = false,
  minHeight = 58,
  variant = 'default',
  className,
  children,
}: RowProps) {
  const isYou = variant === 'you'
  return (
    <div
      className={[
        'sv-row',
        isYou ? 'sv-row--you' : minHeight === 56 ? 'sv-row--56' : '',
        isYou ? '' : divider ? 'sv-row--divider' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {leading}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </div>
  )
}
