// Pure extraction of the five nav icons out of Savborne-handoff.html.
//
// The icons are 16x16 Tiny Dungeon tiles (Kenney, CC0) whose source pack lives in
// assets-raw/, which is gitignored (.gitignore:45). That makes the handoff the only
// durable copy, so it is the extraction source rather than the pack.
//
// Two details cost an iteration to learn and are encoded here deliberately:
//
// 1. Slice screens by their `id="A_` boundaries. Taking
//    html.slice(html.indexOf('id="A_Home"')) and then lastIndexOf('<nav') on that
//    runs to the end of the document and silently grabs the LAST screen's nav bar,
//    producing another screen's icons.
// 2. The label styles are inline on each <a>, not in the document's <style> block,
//    and the label is a bare text node after the <svg>.
//
// The art is multi-colour, so the asset keeps both states verbatim: a Home tile is
// four fills and its active state is a per-path hue remap, not a uniform tint.

export const TABS = ['home', 'battle', 'missions', 'ranks', 'profile']

/** Fails loudly rather than returning a partial or arbitrary asset. */
export function extractNavIcons(html) {
  const marks = [...html.matchAll(/id="(A_[A-Za-z0-9]+)"/g)].map((m) => ({
    id: m[1],
    at: m.index,
  }))

  const seen = { active: {}, inactive: {} }
  let bars = 0

  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].at : html.length
    const chunk = html.slice(marks[i].at, end)
    const navStart = chunk.lastIndexOf('<nav')
    if (navStart < 0) continue

    const anchors = [...chunk.slice(navStart).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    if (anchors.length !== 5) continue
    bars++

    for (const [, attrs, inner] of anchors) {
      const label = inner.replace(/<[^>]+>/g, '').trim().toLowerCase()
      const state = /aria-current="page"/.test(attrs) ? 'active' : 'inactive'
      const svg = (inner.match(/<svg[\s\S]*?<\/svg>/) || [])[0]

      if (!svg) throw new Error(`${marks[i].id}: "${label}" has no <svg>`)
      if (seen[state][label] && seen[state][label] !== svg) {
        throw new Error(`inconsistent ${state} art for "${label}" at ${marks[i].id}`)
      }
      seen[state][label] = svg
    }
  }

  if (bars !== 10) throw new Error(`expected 10 in-screen nav bars, saw ${bars}`)

  const icons = {}
  for (const tab of TABS) {
    if (!seen.active[tab]) throw new Error(`missing active icon for "${tab}"`)
    if (!seen.inactive[tab]) throw new Error(`missing inactive icon for "${tab}"`)
    icons[tab] = { active: seen.active[tab], inactive: seen.inactive[tab] }
  }

  return { icons, bars }
}
