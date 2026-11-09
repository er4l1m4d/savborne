/**
 * Savborne - Welcome
 *
 * The handoff's first screen: brand lockup, character art, the product promise
 * and one coral CTA. No step bars; onboarding starts properly on `/connect`.
 */

import { BrandMark } from '@/components/BrandMark'
import { CharacterArt } from '@/components/CharacterArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { ButtonLink } from '@/components/ui/Button'

export default function WelcomePage() {
  return (
    <ScreenShell variant="pushed" bodyClassName="pt-0 gap-5">
      <BrandMark />

      <PixelPanel className="h-[300px] flex items-center justify-center">
        <div className="w-[220px] h-[260px] bg-sprite-well flex items-center justify-center">
          <CharacterArt bracket={null} size={144} />
        </div>
      </PixelPanel>

      <div className="flex flex-col gap-3">
        <h1 className="sv-display-sm">
          Save for real.
          <br />
          Level up for fun.
        </h1>
        <p className="sv-body text-fg-muted">
          Check in on your NIM savings, earn XP and items, and battle other players.
          Savborne never holds or moves your money.
        </p>
      </div>

      <div className="mt-auto flex flex-col items-center gap-[14px]">
        <ButtonLink href="/connect" variant="primary">
          Get started
        </ButtonLink>
        <span className="sv-label text-fg-muted text-center">Built for Nimiq Pay</span>
      </div>
    </ScreenShell>
  )
}
