'use client'

/**
 * Savborne - 44px filter chip
 *
 * A pressed-state button, not a tab: Everyone/Friends filter a list, they do
 * not switch panels. The selected state is cream fill with ground text, as the
 * Ranks handoff draws it; mint stays for tabs and progress.
 */

import type { ReactNode } from 'react'

type FilterChipProps = {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}

export function FilterChip({ pressed, onClick, children }: FilterChipProps) {
  return (
    <button type="button" className="sv-filter" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}
