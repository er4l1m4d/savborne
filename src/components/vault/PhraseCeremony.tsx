'use client'

/**
 * Savborne — the 24-word backup ceremony (Backup step 3 of 5, part 1).
 *
 * The words are shown once, in a numbered grid, and never leave this
 * component. There is deliberately no copy-to-clipboard button: the clipboard
 * is shared with every other app on the phone, and a phrase in it is a phrase
 * on the internet. "Selectable text" is the only convenience offered.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { BACKUP_RISK } from '@/lib/onboarding-copy'

export function PhraseCeremony({
  phrase,
  onContinue,
  onBack,
}: {
  phrase: string[]
  onContinue: () => void
  onBack: () => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <section className="flex flex-col gap-4">
      <h1 className="sv-heading">Your vault key</h1>
      <p className="sv-body text-fg-muted">{BACKUP_RISK}</p>

      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {phrase.map((word, i) => (
          <li
            key={i}
            className="vpx bg-surface-low p-2 flex items-baseline gap-2 font-mono text-sm select-text"
          >
            <span className="sv-figure text-fg-faint w-5 text-right shrink-0">{i + 1}</span>
            <span className="break-all">{word}</span>
          </li>
        ))}
      </ol>

      <label className="flex items-start gap-3 sv-label text-fg-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>I have written these 24 words down and stored them somewhere safe.</span>
      </label>

      <Button variant="primary" onClick={onContinue} disabled={!acknowledged}>
        Continue
      </Button>
      <Button variant="ghost" className="self-start" onClick={onBack}>
        Back
      </Button>
    </section>
  )
}
