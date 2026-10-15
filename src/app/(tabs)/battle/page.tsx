/**
 * Savborne — Battle menu (Phase 3 placeholder)
 *
 * Shows the three battle modes from spec Section 9.3 with their copy, but
 * none are wired to the engine yet — the game logic and API land in Phase 4
 * (AI + friend) and Phase 5 (ranked). Until then every mode renders a
 * "Coming in Phase N" panel so a real tester sees the shape of what's next
 * rather than a blank tab.
 */

'use client'

const MODES = [
  {
    id: 'ai',
    title: 'Savborne AI',
    blurb: 'Battle the Savborne AI. Unranked.',
    phase: 'Phase 4',
    tone: 'mint',
  },
  {
    id: 'friend',
    title: 'Challenge a friend',
    blurb: 'Challenge a friend. Unranked.',
    phase: 'Phase 4',
    tone: 'butter',
  },
  {
    id: 'ranked',
    title: 'Ranked match',
    blurb: 'Find a ranked match in your bracket.',
    phase: 'Phase 5',
    tone: 'coral',
  },
] as const

export default function BattlePage() {
  return (
    <main className="p-[var(--gut)] max-w-[420px] mx-auto w-full flex flex-col gap-5">
      <header className="mt-4">
        <h1
          className="text-3xl leading-none"
          style={{ fontFamily: 'var(--font-silkscreen)' }}
        >
          Battle
        </h1>
        <p className="text-sm text-fg-muted mt-2">
          Three battle modes. Same five-turn structure, no chance-based
          outcomes. Battles unlock progressively as the build matures.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {MODES.map((m) => (
          <li
            key={m.id}
            className="vpx-soft bg-surface p-4 flex items-start justify-between gap-3 opacity-80"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="text-base font-bold">{m.title}</h2>
              <p className="text-xs text-fg-muted leading-snug">{m.blurb}</p>
            </div>
            <span
              className={`text-[10px] uppercase tracking-widest font-bold shrink-0 text-${m.tone}-text`}
            >
              {m.phase}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-fg-faint text-center leading-relaxed pt-2 border-t border-line">
        Daily limit: 3 battles across all modes. Turn timeout defaults to
        Defend. Battles give the same XP regardless of opponent type.
      </p>
    </main>
  )
}
