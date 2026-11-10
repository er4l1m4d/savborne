/**
 * Savborne - rank-1 crown
 *
 * The handoff draws a 24x24 crown beside the first row of both Ranks figures.
 * It is a rank flourish, not the 16px Golden Crown item and not the
 * gold-bracket badge in `src/lib/game/badges.ts`: this crown means "rank 1".
 * The paths are copied verbatim from `Savborne-handoff.html`
 * (`aria-label="Golden Crown badge"` in figure `A_RanksRanked`) and a source
 * test pins them, so the art cannot drift.
 *
 * Decorative: the rank cell already announces `Rank 1`, so the crown is hidden
 * from assistive technology.
 */

export function RankCrown({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
      className="shrink-0"
    >
      <path
        fill="#FEE761"
        shapeRendering="crispEdges"
        d="M3 3h1v1h-1zM11 3h1v1h-1zM19 3h1v1h-1zM3 4h1v1h-1zM19 4h1v1h-1zM3 5h3v1h-3zM9 5h1v1h-1zM13 5h1v1h-1zM17 5h3v1h-3zM3 6h2v1h-2zM19 6h1v1h-1zM3 7h1v1h-1zM7 7h1v1h-1zM15 7h1v1h-1zM19 7h1v1h-1zM3 8h1v1h-1zM19 8h1v1h-1zM3 9h1v1h-1zM19 9h1v1h-1zM3 10h1v1h-1zM19 10h1v1h-1zM3 11h1v1h-1zM19 11h1v1h-1zM3 12h1v1h-1zM19 12h1v1h-1zM3 13h1v1h-1zM19 13h1v1h-1zM5 15h13v1h-13zM3 19h17v1h-17z"
      />
      <path
        fill="#BD6C4A"
        shapeRendering="crispEdges"
        d="M4 3h1v1h-1zM12 3h1v1h-1zM20 3h1v1h-1zM4 4h1v1h-1zM11 4h2v1h-2zM20 4h1v1h-1zM6 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM20 5h1v1h-1zM5 6h2v1h-2zM9 6h2v1h-2zM13 6h2v1h-2zM17 6h2v1h-2zM20 6h1v1h-1zM4 7h1v1h-1zM8 7h1v1h-1zM16 7h1v1h-1zM20 7h1v1h-1zM4 8h1v1h-1zM7 8h2v1h-2zM15 8h2v1h-2zM20 8h1v1h-1zM4 9h1v1h-1zM20 9h1v1h-1zM4 10h1v1h-1zM20 10h1v1h-1zM4 11h1v1h-1zM20 11h1v1h-1zM4 12h1v1h-1zM20 12h1v1h-1zM4 13h1v1h-1zM20 13h1v1h-1zM3 14h2v1h-2zM19 14h2v1h-2zM18 15h1v1h-1zM5 16h14v1h-14zM20 19h1v1h-1zM3 20h18v1h-18z"
      />
    </svg>
  )
}
