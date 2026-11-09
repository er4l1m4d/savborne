/**
 * Savborne - battle mode card
 *
 * The handoff draws the three menu modes as full-width cards with an icon, a
 * title, a blurb and sometimes a meta line. An available mode is a real button;
 * an unavailable one is an off panel, not a disabled button that does nothing.
 */

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { PixelPanel } from '@/components/ui/PixelPanel'

type ModeCardProps = {
  title: string
  blurb: string
  meta?: string
  icon?: ReactNode
  primary?: boolean
  onClick?: () => void
  disabled?: boolean
  /** Extra content under the blurb, e.g. the ranked requirement meters. */
  extra?: ReactNode
  footnote?: string
}

function ModeCardBody({
  title,
  blurb,
  meta,
  icon,
  primary,
  extra,
  footnote,
}: Omit<ModeCardProps, 'onClick' | 'disabled'>) {
  return (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="sv-subheading sv-break">{title}</span>
        <span className={`sv-label ${primary ? 'text-background/80' : 'text-fg-muted'}`}>
          {blurb}
        </span>
        {meta && (
          <span className={`sv-label ${primary ? 'text-background' : 'text-fg'}`}>{meta}</span>
        )}
        {extra}
        {footnote && <span className="sv-label text-fg-faint">{footnote}</span>}
      </span>
    </>
  )
}

export function ModeCard({ onClick, disabled, primary, ...content }: ModeCardProps) {
  if (onClick && !disabled) {
    return (
      <Button
        variant={primary ? 'primary' : 'secondary'}
        size="mode"
        onClick={onClick}
        className="w-full"
      >
        <ModeCardBody {...content} primary={primary} />
      </Button>
    )
  }

  return (
    <PixelPanel tone="off" className="flex min-h-[96px] items-start gap-4 px-4 py-4">
      <ModeCardBody {...content} />
    </PixelPanel>
  )
}
