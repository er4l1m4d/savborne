'use client'

/**
 * Savborne - loading state
 *
 * Three 8px pixel dots and nothing else. The 150ms delay keeps a fast load from
 * flashing the loader; reduced motion leaves the dots static. The accessible
 * label is not drawn.
 */

import { useEffect, useState } from 'react'

export function LoadingState({ label = 'Loading Savborne...' }: { label?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 150)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className="flex flex-1 items-center justify-center py-16"
      role="status"
      aria-label={label}
    >
      <span className="sv-loader" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </div>
  )
}
