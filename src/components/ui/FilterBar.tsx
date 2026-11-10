'use client'

/**
 * Savborne - segmented filter bar
 *
 * One beveled track with a pressed-state segment per option. The track draws
 * at 32px; each segment is a 44px button so the touch target survives the
 * smaller visual. The selected segment is cream with ground text, as the Ranks
 * handoff draws its filter, while mint stays for tabs and progress.
 */

export type FilterOption = { value: string; label: string }

type FilterBarProps = {
  ariaLabel: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}

export function FilterBar({ ariaLabel, options, value, onChange }: FilterBarProps) {
  return (
    <div className="sv-filterbar" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="sv-filterbar__btn"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span className="sv-filterbar__seg">{option.label}</span>
        </button>
      ))}
    </div>
  )
}
