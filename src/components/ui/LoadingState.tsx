'use client'

/**
 * Savborne - branded loading state
 *
 * Used wherever a screen waits on data. The logo and three pixel dots are
 * always correct, even before the player's chosen character is known. The
 * 150ms delay keeps a fast load from flashing the loader; reduced motion
 * leaves the dots static.
 */

import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/BrandMark'

export function LoadingState({ label = 'Loading Savborne...' }: { label?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 150)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <BrandMark />
      <span className="sv-loader" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="sv-body text-fg-muted">{label}</span>
    </div>
  )
}
