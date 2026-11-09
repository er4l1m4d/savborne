import type { ReactNode } from 'react'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { StepBars, StepLabel } from '@/components/ui/StepBars'

/**
 * Savborne - onboarding screen shell
 *
 * The handoff's pushed shell: a 44px back button, the "Step N of 5" label on
 * the right, then one 8px bar per step. The label carries the semantics; the
 * bars are decorative.
 */

export function OnboardingScreen({
  step,
  total = 5,
  backHref,
  bodyClassName,
  children,
}: {
  step: number
  total?: number
  backHref: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <ScreenShell
      variant="pushed"
      backHref={backHref}
      actions={<StepLabel step={step} total={total} />}
      bodyClassName={`gap-[18px] ${bodyClassName ?? ''}`.trim()}
    >
      <StepBars step={step} total={total} />
      {children}
    </ScreenShell>
  )
}
