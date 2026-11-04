/**
 * Savborne — Tabs group layout
 *
 * Wraps every primary screen with the bottom nav and reserves vertical space so
 * content never renders under it. Home, Battle, Missions, Ranks and Profile all
 * live under this group so they share the same navigation chrome. Vault is not a
 * tab; it is reached from the Home savings card. Onboarding (`/setup`) sits
 * outside this group — it has its own no-nav layout because a first-time user
 * shouldn't be able to navigate before they've connected an account.
 */

import { PixelNav } from '@/components/PixelNav'
import { VaultGuard } from '@/components/VaultGuard'
import { VaultTour } from '@/components/VaultTour'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <VaultGuard />
      <VaultTour />
      <div
        className="flex-1 flex flex-col"
        style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </div>
      <PixelNav />
    </div>
  )
}
