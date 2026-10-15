/**
 * Savborne — Bottom tab bar
 *
 * Five tabs (Home / Missions / Battle / Profile / Leaderboard) using Next.js
 * route groups under `src/app/(tabs)`. Highlighted tab matches the current
 * URL path. Renders as a fixed bottom strip sized to fit inside a mobile
 * WebView.
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = {
  href: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { href: '/', label: 'Home', icon: '⛰' },
  { href: '/missions', label: 'Missions', icon: '📜' },
  { href: '/battle', label: 'Battle', icon: '⚔' },
  { href: '/profile', label: 'Profile', icon: '☰' },
  { href: '/leaderboard', label: 'Ranks', icon: '★' },
]

export function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex justify-around items-stretch bg-surface border-t-2 border-line"
      style={{ height: 'var(--nav-h)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 flex-1 no-underline transition-colors ${
              active ? 'text-mint' : 'text-fg-muted hover:text-foreground'
            }`}
          >
            <span className="text-xl leading-none" aria-hidden>
              {t.icon}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-bold">
              {t.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
