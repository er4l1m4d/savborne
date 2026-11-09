import type { ReactNode } from 'react'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { StepBars } from '@/components/ui/StepBars'

/**
 * Savborne - onboarding screen shell
 *
 * The handoff's pushed shell for steps 1-3: a 44px back button, the "Step N of
 * 3" label on the right, then the three 8px bars. The label carries the
 * semantics; the bars are decorative.
 */

export function OnboardingScreen({
  step,
  backHref,
  bodyClassName,
  children,
}: {
  step: number
  backHref: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <ScreenShell
      variant="pushed"
      backHref={backHref}
      actions={
        <span className="sv-label text-fg-muted" aria-current="step">
          Step {step} of 3
        </span>
      }
      bodyClassName={`gap-[18px] ${bodyClassName ?? ''}`.trim()}
    >
      <StepBars step={step} total={3} />
      {children}
    </ScreenShell>
  )
}
