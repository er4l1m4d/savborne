/**
 * Savborne - brand mark
 *
 * The handoff's Welcome and Preparing screens open with the same lockup: a
 * 24x24 pixel logo beside an 82x7 pixel wordmark. Both drawings are lifted from
 * `Savborne-handoff.html` into `assets/brand.json` so they cannot drift from the
 * design of record, the same rule `Glyphs.tsx` follows.
 */

import brand from '../../assets/brand.json'

export function BrandMark() {
  return (
    <span className="flex h-11 items-center gap-[10px]">
      <svg
        width={36}
        height={36}
        viewBox={brand.logo.viewBox}
        aria-hidden
        focusable="false"
        dangerouslySetInnerHTML={{ __html: brand.logo.paths }}
      />
      <svg
        width={164}
        height={14}
        viewBox={brand.wordmark.viewBox}
        role="img"
        aria-label="Savborne"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: brand.wordmark.paths }}
      />
    </span>
  )
}
