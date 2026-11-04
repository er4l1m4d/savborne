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
      <h2 className="text-3xl leading-none" style={{ fontFamily: 'var(--font-silkscreen)' }}>
        Confirm your backup
      </h2>
      <p className="text-sm text-fg-muted">
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
              className="vpx bg-surface-low p-3 text-base text-foreground outline-none focus:border-butter w-full font-mono"
            />
          </label>
        ))}
      </div>

      {error && <div className="vpx bg-coral-tint p-3 text-sm text-coral-text">{error}</div>}

      <button
        type="button"
        onClick={check}
        disabled={!allFilled}
        className="vpx bg-mint text-[#0E1D19] py-3 px-4 font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-0.5"
        style={{ boxShadow: '0 3px 0 var(--bevel-shadow)' }}
      >
        Check words
      </button>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-fg-muted underline underline-offset-4 self-start"
      >
        Back
      </button>
    </section>
  )
}
