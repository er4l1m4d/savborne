'use client'

/**
 * Savborne — vault passphrase field (onboarding step 3, part 3).
 *
 * The passphrase encrypts the phrase at rest. It is required to withdraw and
 * to re-display the phrase, and can be reset by re-entering the 24 words.
 *
 * No strength meter: a fake score is worse than a simple rule, so the rule is
 * a hard minimum of 8 characters plus a matching confirmation.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export const MIN_PASSPHRASE_LENGTH = 8

export function PassphraseField({
  onSet,
}: {
  /** Called with the chosen passphrase once both fields match and are long enough. */
  onSet: (passphrase: string) => void
}) {
  const [first, setFirst] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const longEnough = first.length >= MIN_PASSPHRASE_LENGTH
  const matches = first.length > 0 && first === confirm
  const ready = longEnough && matches

  function submit() {
    if (!longEnough) {
      setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`)
      return
    }
    if (!matches) {
      setError('The two passphrases do not match.')
      return
    }
    setError(null)
    onSet(first)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="sv-body text-fg-muted">
        Choose a passphrase. It locks your vault on this device and is asked for before every
        withdrawal. Savborne cannot reset it — but you can reset it yourself with your 24
        words, so it is not another thing to lose.
      </p>

      <label className="flex flex-col gap-1">
        <span className="sv-label text-fg-faint">Passphrase</span>
        <input
          type="password"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          autoComplete="new-password"
          className="vpx bg-surface-low p-3 text-base text-foreground focus:border-mint"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="sv-label text-fg-faint">Confirm passphrase</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="vpx bg-surface-low p-3 text-base text-foreground focus:border-mint"
        />
      </label>

      {error && <Banner tone="error">{error}</Banner>}

      <Button variant="primary" onClick={submit} disabled={!ready}>
        Lock my vault
      </Button>
    </div>
  )
}
