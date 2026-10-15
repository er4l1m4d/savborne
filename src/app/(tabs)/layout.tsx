/**
 * Savborne — Tabs group layout
 *
 * Wraps every primary screen with the bottom tab bar and reserves vertical
 * space so content never renders under the nav. Home, Missions, Battle,
 * Profile, and Leaderboard all live under this group so they share the same
 * navigation chrome. Onboarding (`/setup`) sits outside this group — it has
 * its own no-nav layout because a first-time user shouldn't be able to
 * navigate before they've connected an account.
 */

import { BottomTabBar } from '@/components/BottomTabBar'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <div
        className="flex-1 flex flex-col"
        style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </div>
      <BottomTabBar />
    </div>
  )
}
