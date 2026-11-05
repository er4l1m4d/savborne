'use client'

/**
 * Savborne — two-up tablist
 *
 * Controlled, equal-width 44px tabs. Selected state is mint fill with ground
 * text, matching the handoff's active control.
 */

type TabItem = { value: string; label: string }

type TabsProps = {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

export function Tabs({ items, value, onChange, ariaLabel }: TabsProps) {
  return (
    <div className="sv-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          className="sv-tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
