import type { ReactNode } from 'react'

/**
 * Savborne — result headline, tiles, unlocks and actions
 *
 * No consumer in Foundation 2: Bracket Climb (Economy) and battle results
 * (Battle) are its first users.
 */

export type ResultTile = { label: string; value: string }

type ResultPanelProps = {
  title: string
  tone: 'mint' | 'coral' | 'cream'
  /** Rendered between the headline and the tiles, e.g. the result arena. */
  header?: ReactNode
  tiles: ResultTile[]
  unlocks?: ReactNode[]
  actions: ReactNode
}

const TONE: Record<ResultPanelProps['tone'], string> = {
  mint: 'var(--mint)',
  coral: 'var(--coral-text)',
  cream: 'var(--fg)',
}

export function ResultPanel({ title, tone, header, tiles, unlocks, actions }: ResultPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sv-display" style={{ color: TONE[tone] }}>
        {title}
      </h1>

      {header}

      <div
        className={`grid gap-2 ${
          tiles.length === 1 ? 'grid-cols-1' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
        }`}
      >
        {tiles.map((tile) => (
          <div key={tile.label} className="vpx-soft p-3 flex flex-col gap-1">
            <span className="sv-number-m">{tile.value}</span>
            <span className="sv-label text-fg-faint">{tile.label}</span>
          </div>
        ))}
      </div>

      {unlocks && unlocks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {unlocks.map((unlock, index) => (
            <li key={index}>{unlock}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">{actions}</div>
    </div>
  )
}
