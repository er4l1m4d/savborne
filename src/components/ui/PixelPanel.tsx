import type { CSSProperties, ReactNode } from 'react'

/**
 * Savborne — stepped pixel panel
 *
 * The handoff draws panels as a 3px stepped corner plus a 4px hard shadow, not
 * a square `.vpx` border. The wrapper carries the drop-shadow outline (a
 * `clip-path` cannot cast a shadow) and the inner element carries the polygon.
 * Tone variables live in `globals.css`.
 */

type Tone = 'default' | 'mint' | 'coral' | 'cream' | 'off'

type PixelPanelProps = {
  tone?: Tone
  /** Applied to the inner `.px`, so existing padding utilities keep working. */
  className?: string
  /** Applied to the `.pxw` wrapper, for absolute positioning and layout. */
  wrapperClassName?: string
  /** Applied to the wrapper; `VaultTour` positions the whole shadowed box. */
  style?: CSSProperties
  children: ReactNode
}

export function PixelPanel({
  tone = 'default',
  className,
  wrapperClassName,
  style,
  children,
}: PixelPanelProps) {
  return (
    <div
      className={`pxw ${wrapperClassName ?? ''}`.trim()}
      data-tone={tone}
      style={style}
    >
      <div className={`px sv-panel ${className ?? ''}`.trim()}>{children}</div>
    </div>
  )
}
