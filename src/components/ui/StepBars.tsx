/**
 * Savborne - onboarding step bars
 *
 * Three 8px bars, mint up to and including the current step. The bars are
 * decorative: the visible "Step N of 3" label in the screen header carries the
 * accessible name and `aria-current="step"`.
 */

export function StepBars({ step, total = 3 }: { step: number; total?: number }) {
  const safeTotal = Math.max(1, total)
  const current = Math.max(1, Math.min(safeTotal, step))

  return (
    <ol className="sv-steps" aria-hidden>
      {Array.from({ length: safeTotal }, (_, index) => (
        <li key={index} data-fill={index < current ? 'true' : 'false'} />
      ))}
    </ol>
  )
}
