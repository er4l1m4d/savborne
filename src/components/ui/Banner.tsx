import type { ReactNode } from 'react'

/**
 * Savborne — error / info note
 *
 * Error is the default because most banners in this app are failures. Error
 * speaks as an alert; info is a polite status.
 */

type BannerProps = {
  tone?: 'error' | 'info'
  children: ReactNode
}

export function Banner({ tone = 'error', children }: BannerProps) {
  if (tone === 'info') {
    return (
      <div className="sv-banner sv-banner--info" role="status">
        {children}
      </div>
    )
  }

  return (
    <div className="sv-banner sv-banner--error" role="alert">
      {children}
    </div>
  )
}
