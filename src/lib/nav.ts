/**
 * Savborne — the bottom nav, as data
 *
 * Tab order and labels come from "Savborne-handoff.html" (Home, Battle,
 * Missions, Ranks, Profile). The hrefs stay this app's real routes — /home and
 * /ranks are not created — so the port moves labels and art, not the router.
 *
 * Vault is deliberately not a tab. It is reached from the Home savings card,
 * and VaultGuard routes vaultless players to /vault on its own.
 *
 * Keeping this out of the component means the active-matching rules are
 * testable without a React renderer.
 */

export type NavIcon = 'home' | 'battle' | 'missions' | 'ranks' | 'profile'

export type NavTab = { href: string; label: string; icon: NavIcon }

export const NAV_TABS: readonly NavTab[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/battle', label: 'Battle', icon: 'battle' },
  { href: '/missions', label: 'Missions', icon: 'missions' },
  { href: '/leaderboard', label: 'Ranks', icon: 'ranks' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
]

/**
 * Whether `href`'s tab is the current one.
 *
 * `pathname === href` is not enough: a pushed screen like /battle/123 would
 * leave the whole nav unhighlighted while the player is mid-battle. Matching on
 * `href + '/'` also keeps /battlefield from lighting up Battle.
 *
 * The root tab matches only the root — every path starts with '/'.
 */
export function isTabActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname === href + '/' || pathname.startsWith(href + '/')
}
