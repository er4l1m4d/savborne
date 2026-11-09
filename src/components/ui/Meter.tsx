/**
 * Savborne - progress / HP meter
 *
 * The handoff uses one 14px bevelled trough for HP, rank requirements, the
 * queue timer and the reconnect grace. Battle is its first consumer. A labelled
 * meter is a progressbar; an unlabelled one is decorative because adjacent text
 * already states the value.
 */

type MeterTone = 'mint' | 'coral' | 'butter'

type MeterProps = {
  value: number
  max: number
  tone?: MeterTone
  height?: number
  label?: string
  className?: string
}

export function Meter({
  value,
  max,
  tone = 'mint',
  height = 14,
  label,
  className,
}: MeterProps) {
  const safeMax = Math.max(1, max)
  const clamped = Math.max(0, Math.min(safeMax, value))
  const pct = (clamped / safeMax) * 100

  return (
    <div
      className={`sv-meter ${className ?? ''}`.trim()}
      style={{ height }}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? safeMax : undefined}
      aria-valuenow={label ? clamped : undefined}
      aria-hidden={label ? undefined : true}
    >
      <div
        className="sv-meter__fill"
        style={{ width: `${pct}%`, background: `var(--${tone})` }}
      />
    </div>
  )
}
