import type { ReactNode } from 'react'

/**
 * Savborne — grouped-list row
 *
 * The parent `PixelPanel` supplies horizontal padding; a `Row` supplies the
 * 58px (or 56px rank) rhythm and the divider. The title column is `min-w-0` so
 * long names wrap instead of pushing the trailing figure off-screen.
 */

type RowProps = {
  leading?: ReactNode
  trailing?: ReactNode
  divider?: boolean
  minHeight?: 56 | 58
  /** Extra classes on the row itself, e.g. the current player's highlight. */
  className?: string
  children: ReactNode
}

export function Row({
  leading,
  trailing,
  divider = false,
  minHeight = 58,
  className,
  children,
}: RowProps) {
  return (
    <div
      className={[
        'sv-row',
        minHeight === 56 ? 'sv-row--56' : '',
        divider ? 'sv-row--divider' : '',
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
