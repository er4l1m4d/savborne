/**
 * Savborne — Leaderboard (Phase 3 placeholder)
 *
 * Renders the two boards (Ranked, Unranked) as empty-state cards with the
 * description from spec Section 10.4. Real data + friends filter land in
 * Phase 5 when the ranked queue is live.
 */

export default function LeaderboardPage() {
  return (
    <main className="p-[var(--gut)] max-w-[420px] mx-auto w-full flex flex-col gap-5">
      <header className="mt-4">
        <h1
          className="text-3xl leading-none"
          style={{ fontFamily: 'var(--font-silkscreen)' }}
        >
          Leaderboards
        </h1>
        <p className="text-sm text-fg-muted mt-2">
          Two boards, both showing display names only. Your wallet address is
          never published.
        </p>
      </header>

      <BoardCard
        title="Ranked"
        caption="Main status board"
        blurb="Ranked points (Elo) and wins. Only human ranked battles change the score."
        comingSoon="Phase 5"
      />
      <BoardCard
        title="Unranked"
        caption="Everyone counts"
        blurb="Total wins and savings growth. Includes friend and AI battles."
        comingSoon="Phase 5"
      />

      <p className="text-[11px] text-fg-faint text-center leading-relaxed pt-2 border-t border-line">
        Everyone appears by default. A friends-only filter will be added when
        the ranking API lands.
      </p>
    </main>
  )
}

function BoardCard({
  title,
  caption,
  blurb,
  comingSoon,
}: {
  title: string
  caption: string
  blurb: string
  comingSoon: string
}) {
  return (
    <section className="vpx-soft bg-surface p-4 flex flex-col gap-1.5 opacity-80">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <span className="text-[10px] uppercase tracking-widest text-fg-faint shrink-0">
          {caption}
        </span>
      </div>
      <p className="text-xs text-fg-muted leading-snug">{blurb}</p>
      <p className="text-[10px] uppercase tracking-widest text-mint pt-1">
        Live in {comingSoon}
      </p>
    </section>
  )
}
