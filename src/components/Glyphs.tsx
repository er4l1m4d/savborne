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
import badges from '../../assets/badges.json'

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

type BadgeName = keyof typeof badges
type BadgeState = 'earned' | 'locked' | 'removed'

/**
 * Badge art from assets/badges.json.
 *
 * The app used to show badges as `◈` / `◇`, which collapsed three designed states into two
 * characters and used none of the real art. Each badge ships an earned, locked and removed
 * pixel drawing on the same 24x24 grid as the glyphs, so it is rendered the same way and from
 * the same kind of source.
 *
 * The `reachableStates` guard is the reason this component exists rather than a bare lookup.
 * Every gate passed a "removed" drawing for badges the game can never revoke, because
 * reachability is not a pixel property — a screen that draws an impossible state looks fine
 * to a pixel test. Enforcing it here is the one place that knows both the art and the rules.
 */
export function BadgeArt({
  badge,
  state,
  size = 32,
  className,
  title,
}: {
  badge: BadgeName
  state: BadgeState
  size?: number
  className?: string
  title?: string
}) {
  const badgeArt = badges[badge]
  if (!badgeArt) throw new Error(`Badge "${String(badge)}" is not in assets/badges.json`)
  if (badgeArt.viewBox !== GLYPH_GRID) {
    throw new Error(`Badge "${String(badge)}" is ${badgeArt.viewBox}, expected ${GLYPH_GRID}`)
  }
  if (!badgeArt.reachableStates.includes(state)) {
    throw new Error(
      `Badge "${String(badge)}" cannot be "${state}" — the game can only produce ` +
        `${badgeArt.reachableStates.join(', ')}. See ERRORS.md drawing-a-state-the-game-cannot-produce.`,
    )
  }
  const markup = badgeArt.states[state]
  if (!markup) throw new Error(`Badge "${String(badge)}" has no "${state}" artwork`)

  return (
    <svg
      width={size}
      height={size}
      viewBox={badgeArt.viewBox}
      className={className}
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
