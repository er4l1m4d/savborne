'use client'

/**
 * Savborne — the 24-word backup ceremony (onboarding step 3, part 1).
 *
 * The words are shown once, in a numbered grid, and never leave this
 * component. There is deliberately no copy-to-clipboard button: the clipboard
 * is shared with every other app on the phone, and a phrase in it is a phrase
 * on the internet. "Selectable text" is the only convenience offered.
 */

import { useState } from 'react'

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
    <section className="flex flex-col gap-4 mt-4">
      <h1 className="text-3xl leading-none" style={{ fontFamily: 'var(--font-silkscreen)' }}>
        Your vault key
      </h1>
      <p className="text-sm text-fg-muted">
        These 24 words are the only key to your vault, and they never leave this device.
        Savborne cannot see them and cannot recover your NIM without them. If you lose them
        and this phone, the money in the vault is gone.
      </p>

      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {phrase.map((word, i) => (
          <li
            key={i}
            className="vpx bg-surface-low p-2 flex items-baseline gap-2 font-mono text-sm select-text"
          >
            <span className="text-fg-faint text-[11px] w-5 text-right shrink-0">{i + 1}</span>
            <span className="break-all">{word}</span>
          </li>
        ))}
      </ol>

      <label className="flex items-start gap-3 text-sm text-fg-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>I have written these 24 words down and stored them somewhere safe.</span>
      </label>

      <button
        type="button"
        onClick={onContinue}
        disabled={!acknowledged}
        className="vpx bg-mint text-[#0E1D19] py-3 px-4 font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-0.5"
        style={{ boxShadow: '0 3px 0 var(--bevel-shadow)' }}
      >
        Continue
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
