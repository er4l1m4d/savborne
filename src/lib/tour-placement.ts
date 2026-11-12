/**
 * Savborne - tour card placement (pure)
 *
 * The card must never cover the anchor it points at. It is placed in the
 * larger free side, keeps a gap from the spotlight, and caps its own height to
 * that side so long copy scrolls inside the card instead of growing back over
 * the target.
 *
 * Kept out of the component so the no-overlap rule is unit-tested with plain
 * rectangles, not a rendered DOM.
 */

export type TourRect = {
  top: number
  left: number
  width: number
  height: number
  bottom: number
}

export type TourViewport = { width: number; height: number }

export type TourFrame = { left: number; right: number }

export type TourCardPlacement = {
  left: number
  transform: 'translateX(-50%)' | 'translate(-50%, -50%)'
  top?: number
  bottom?: number
  maxHeight: number
  /** Tighten padding, gaps and text so the card fits without scrolling. */
  compact: boolean
}

/** Space kept between the card and the viewport edge / the spotlight. */
const MARGIN = 16
/** Space kept between the spotlight ring and the card. */
const GAP = 16
/** A side shorter than this is not worth placing a card in. */
const MIN_READABLE = 160
/** Below this, neither side can show a usable card; centre it instead. */
const MIN_SIDE = 120
/**
 * The full card is about 250px tall on a narrow phone. Below this much free
 * side, tighten the card rather than let it scroll.
 */
const COMPACT_BELOW = 300

export function placeTourCard(args: {
  rect: TourRect | null
  viewport: TourViewport
  frame?: TourFrame | null
  /**
   * Natural height of the card, measured after render. When present, a side
   * that cannot show the whole card is not chosen while the other side can.
   */
  cardHeight?: number
}): TourCardPlacement {
  const { rect, viewport, frame } = args
  const cardHeight = args.cardHeight && args.cardHeight > 0 ? args.cardHeight : 0

  // The card is at most 360px wide, so its half-width is capped at 180.
  const half = Math.min(180, Math.max(0, (viewport.width - MARGIN * 2) / 2))
  const minX = frame ? frame.left + half + 8 : half
  const maxX = frame ? frame.right - half - 8 : viewport.width - half
  const centerX = rect
    ? clamp(rect.left + rect.width / 2, minX, maxX)
    : viewport.width / 2

  // No anchor yet: centre the card and let the screen settle.
  if (!rect) {
    return {
      top: viewport.height / 2,
      left: centerX,
      transform: 'translate(-50%, -50%)',
      maxHeight: Math.max(0, viewport.height - MARGIN * 2),
      compact: false,
    }
  }

  const spaceBelow = Math.max(0, viewport.height - rect.bottom - MARGIN - GAP)
  const spaceAbove = Math.max(0, rect.top - MARGIN - GAP)
  const largestSide = Math.max(spaceAbove, spaceBelow)

  // A very short viewport can leave no readable side. Centre the card rather
  // than shrinking it to nothing; the ring still marks the target.
  if (largestSide < MIN_SIDE) {
    return {
      top: viewport.height / 2,
      left: centerX,
      transform: 'translate(-50%, -50%)',
      maxHeight: Math.max(0, viewport.height - MARGIN * 2),
      compact: true,
    }
  }

  // Prefer below when it can show the whole card. If only one side fits, use
  // it; when neither fits, use the larger side and let the card scroll there.
  // Never clamp the card back over the anchor to make it fit.
  const needed = cardHeight > 0 ? cardHeight : MIN_READABLE
  const fitsBelow = spaceBelow >= needed
  const fitsAbove = spaceAbove >= needed
  const placeBelow = fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)

  if (placeBelow) {
    const top = Math.min(rect.bottom + GAP, viewport.height - MARGIN)
    return {
      top,
      left: centerX,
      transform: 'translateX(-50%)',
      maxHeight: Math.max(0, viewport.height - top - MARGIN),
      compact: largestSide < COMPACT_BELOW,
    }
  }

  // Anchored by its bottom edge so the card can grow upwards without needing
  // to know its rendered height.
  const bottom = Math.max(viewport.height - rect.top + GAP, MARGIN)
  return {
    bottom,
    left: centerX,
    transform: 'translateX(-50%)',
    maxHeight: Math.max(0, viewport.height - bottom - MARGIN),
    compact: largestSide < COMPACT_BELOW,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
