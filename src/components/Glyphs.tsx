/**
 * Savborne — pixel glyphs from assets/glyphs.json
 *
 * The app previously rendered every icon as a unicode character (⛰ 📜 ⚔ ☰ ★ on the
 * tab bar, ◈ ◇ for badges), while the real art existed only in Savborne-handoff.html.
 * This pulls the glyphs the app needs out of the same source the document was built
 * from, so the two cannot drift.
 *
 * The path data is imported rather than hand-copied on purpose: `scripts/glyph-provenance.mjs`
 * exists because hand-maintained SVG in this project has silently diverged from its source
 * before (four glyphs shipped with pixels carved out of them). One source, no transcription.
 *
 * `dangerouslySetInnerHTML` is appropriate and narrow here: `paths` is a build-time constant
 * read from a JSON file in this repository, not user input, and the document renders the
 * exact same string the exact same way.
 */

import glyphs from '../../assets/glyphs.json'

type GlyphName = keyof typeof glyphs

/** 24x24 is the only grid this app uses for chrome glyphs. A different grid is a bug, not a preference. */
const GLYPH_GRID = '0 0 24 24'

export function Glyph({
  name,
  size = 24,
  className,
  title,
}: {
  name: GlyphName
  size?: number
  className?: string
  title?: string
}) {
  const glyph = glyphs[name]
  if (!glyph) throw new Error(`Glyph "${String(name)}" is not in assets/glyphs.json`)
  if (glyph.viewBox !== GLYPH_GRID) {
    throw new Error(`Glyph "${String(name)}" is ${glyph.viewBox}, expected ${GLYPH_GRID}`)
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={glyph.viewBox}
      className={className}
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: glyph.paths }}
    />
  )
}
