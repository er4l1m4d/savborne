/**
 * Savborne — bottom nav
 *
 * Five tabs from `@/lib/nav`: Home, Battle, Missions, Ranks, Profile. Order,
 * labels and art come from "Savborne-handoff.html"; the hrefs stay this app's
 * routes. Vault is not a tab — the Home savings card links to it.
 *
 * The icons are 16x16 Tiny Dungeon tiles, extracted verbatim into
 * `assets/nav-icons.json` because their source pack is gitignored. They are
 * multi-colour on purpose: a Home tile is four fills, and its active state is a
 * per-path hue remap rather than a tint. Do not recolour them with
 * `currentColor` or a CSS filter — the active state is already in the art.
 *
 * `dangerouslySetInnerHTML` is the same narrow, justified use as in `Glyphs.tsx`:
 * the string is a build-time constant from a file in this repository, not input.
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import navIcons from '../../assets/nav-icons.json'
import { NAV_TABS, isTabActive } from '@/lib/nav'

export function PixelNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-stretch bg-background border-t-2 border-bevel"
      style={{
        height: 'var(--nav-h)',
        padding: '8px 12px 20px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Primary"
    >
      {NAV_TABS.map((tab) => {
        const active = isTabActive(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-tour={tab.href === '/' ? 'home' : undefined}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-14 no-underline transition-colors ${
              active ? 'text-mint' : 'text-fg-muted hover:text-foreground'
            }`}
          >
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center"
              dangerouslySetInnerHTML={{
                __html: navIcons.icons[tab.icon][active ? 'active' : 'inactive'],
              }}
            />
            <span className={`text-xs ${active ? 'font-bold' : 'font-semibold'}`}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
