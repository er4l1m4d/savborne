'use client'

/**
 * Savborne - Couldn't read balance
 *
 * Shown only when the check-in's chain read fails (503 rpc_unreachable). The
 * important promise is that nothing was recorded and the balance was not
 * counted as zero. Try again leaves a one-shot flag for Home.
 */

import { useRouter } from 'next/navigation'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Glyph } from '@/components/Glyphs'
import { writeBalanceRetry } from '@/lib/balance-retry'

export default function BalanceErrorPage() {
  const router = useRouter()

  function onRetry() {
    writeBalanceRetry()
    router.replace('/')
  }

  return (
    <ScreenShell variant="pushed" bodyClassName="pt-0">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <PixelPanel
          tone="coral"
          className="w-[132px] h-[132px] flex items-center justify-center sv-shake"
        >
          <Glyph name="alert" size={72} className="text-coral" />
        </PixelPanel>
        <div className="flex flex-col gap-2">
          <h1 className="sv-subheading-lg">Couldn&apos;t read your balance</h1>
          <p className="sv-body text-fg-muted">
            This check-in wasn&apos;t recorded, and your balance wasn&apos;t counted as
            zero. Your streak and XP are safe. Check your connection and try again.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary">
          Go back to Home
        </ButtonLink>
      </div>
    </ScreenShell>
  )
}
