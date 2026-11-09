import type { ReactNode } from 'react'
import { Glyph } from '@/components/Glyphs'
import { ButtonLink } from '@/components/ui/Button'

/**
 * Savborne — screen shell
 *
 * Owns the two things every screen was hand-rolling: the header row and the
 * scroll region. The tabs layout still owns the bottom nav and its space; a
 * `tab` shell is exactly the height left over, while a `pushed` shell is the
 * full viewport and adds its own bottom safe-area gutter.
 */

type ScreenShellProps = {
  variant?: 'tab' | 'pushed'
  title?: string
  backHref?: string
  /** Accessible name for the back icon. Defaults to "Back". */
  backLabel?: string
  actions?: ReactNode
  bodyClassName?: string
  children: ReactNode
}

export function ScreenShell({
  variant = 'tab',
  title,
  backHref,
  backLabel,
  actions,
  bodyClassName,
  children,
}: ScreenShellProps) {
  const hasHeader = Boolean(title || backHref || actions)

  return (
    <main className={`sv-shell sv-shell--${variant}`}>
      {hasHeader && (
        <header className="sv-shell__header">
          <div className="flex min-w-0 items-center gap-2">
            {backHref && (
              <ButtonLink href={backHref} variant="icon" aria-label={backLabel ?? 'Back'} className="shrink-0">
                <Glyph name="back" size={24} />
              </ButtonLink>
            )}
            {title && <h1 className="sv-shell__title">{title}</h1>}
          </div>
          {actions && (
            <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={`sv-shell__body ${bodyClassName ?? ''}`.trim()}>
        {children}
      </div>
    </main>
  )
}
