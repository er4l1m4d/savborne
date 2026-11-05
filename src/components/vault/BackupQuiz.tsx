'use client'

/**
 * Savborne — backup quiz (onboarding step 3, part 2).
 *
 * Four random positions must be re-typed. This proves the player wrote
 * *something* down; it is a speed bump against tapping through, not
 * cryptographic proof. Re-typing all 24 words on a phone is not acceptable UX,
 * so this trade is made knowingly and must never be described as verification.
 *
 * The chosen positions are memoised in a state initialiser so a re-render
 * cannot reshuffle them out from under a half-finished answer.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

const QUESTION_COUNT = 4

function pickPositions(total: number): number[] {
  const pool = Array.from({ length: total }, (_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, QUESTION_COUNT).sort((a, b) => a - b)
}

export function BackupQuiz({
  phrase,
  onPass,
  onBack,
  inline = false,
}: {
  phrase: string[]
  onPass: () => void
  onBack: () => void
  /** Inside an existing card: drop the top margin the onboarding step needs. */
  inline?: boolean
}) {
  const [positions] = useState(() => pickPositions(phrase.length))
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const allFilled = positions.every((p) => (answers[p] ?? '').trim().length > 0)

  function check() {
    const wrong = positions.filter(
      (p) => (answers[p] ?? '').trim().toLowerCase() !== phrase[p].toLowerCase(),
    )
    if (wrong.length > 0) {
      setError('Some words do not match. Check your written copy.')
      return
    }
    setError(null)
    onPass()
  }

  return (
    <section className={`flex flex-col gap-4 ${inline ? 'mt-0' : 'mt-4'}`}>
      {/* h2, not h1: this is always nested under the step's or the Account section's heading. */}
      <h2 className="sv-heading">Confirm your backup</h2>
      <p className="sv-body text-fg-muted">
        Type these four words from your written copy, in order.
      </p>

      <div className="flex flex-col gap-3">
        {positions.map((p) => (
          <label key={p} className="flex items-center gap-3">
            <span className="font-mono text-sm text-fg-faint w-14 shrink-0">#{p + 1}</span>
            <input
              value={answers[p] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [p]: e.target.value }))}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="vpx bg-surface-low p-3 text-base text-foreground focus:border-mint w-full font-mono"
            />
          </label>
        ))}
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Button variant="primary" onClick={check} disabled={!allFilled}>
        Check words
      </Button>
      <Button variant="ghost" onClick={onBack} className="self-start">
        Back
      </Button>
    </section>
  )
}
