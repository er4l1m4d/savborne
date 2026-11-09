// Ship the reserved `glow` channel into Savborne-handoff.html.
//
//   node scripts/glow-ship.mjs            preview (default) -> assets-raw/glow-preview.html
//   node scripts/glow-ship.mjs --plan     print the slot table only
//   node scripts/glow-ship.mjs --ship     rewrite the artefact
//
// What this does:
//   1. Appends each character's gilt inner rim (assets/character-glows.json) as a <g> INSIDE the
//      existing sprite <svg>, drawn last so it sits on top. Not a nested <svg>: grid-census counts
//      every `<svg viewBox="0 0 16 16">`, so nesting would add 21 entries and shift the census.
//   2. Adds the CSS to BOTH copies of the animation rules. The document deliberately carries two:
//      the live one in <style>, and the copy-paste one in the "Animation CSS" code block. Updating
//      only one leaves the reader copying an out-of-date rule.
//   3. Replaces the battle-turn demo's two colour blocks with real sprites and makes the glow fire
//      on defend, which is what the channel is for.
//   4. Adds the motion-table row for the channel.
//
// Every step asserts. It refuses to write rather than write something wrong.
import fs from 'node:fs'

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'))
const GLOW = JSON.parse(fs.readFileSync('assets/character-glows.json', 'utf8'))
const FILE = 'Savborne-handoff.html'
const PLAN = process.argv.includes('--plan')
const SHIP = process.argv.includes('--ship')

const HERO = 'Hero · Silver'
const FOE = 'Rival · Mint Wraith'
const SPR = '80'

let h = fs.readFileSync(FILE, 'utf8')

if (h.includes('data-glow=')) throw new Error('the artefact already carries glow groups — refusing to double-apply')

// ─── 1. glow group inside every screen sprite ────────────────────────────────
const byContent = new Map(Object.entries(ART).map(([k, v]) => [v, k]))
const slots = []
for (const m of h.matchAll(/<svg\b[^>]*class="spr"[^>]*viewBox="0 0 16 16"[^>]*>/g)) {
  const openAt = m.index
  const innerStart = openAt + m[0].length
  const closeAt = h.indexOf('</svg>', innerStart)
  if (closeAt < 0) throw new Error(`unclosed sprite <svg> at ${openAt}`)
  const inner = h.slice(innerStart, closeAt)
  const name = byContent.get(inner)
  if (!name) throw new Error(`sprite at ${openAt} does not match any characters.json entry verbatim`)
  slots.push({ openAt, innerStart, closeAt, inner, name })
}
if (slots.length !== 21) throw new Error(`expected 21 .spr sprites, found ${slots.length}`)

const galleryStart = h.indexOf('<h3>Character sprites</h3>')
const galleryEnd = h.indexOf('<h3>Item art</h3>', galleryStart)
const gallery = slots.filter((s) => s.openAt > galleryStart && s.openAt < galleryEnd)
console.log(`${slots.length} .spr sprites — ${slots.length - gallery.length} on screens, ${gallery.length} in the gallery\n`)
for (const s of slots) console.log(`  ${(s.openAt > galleryStart && s.openAt < galleryEnd ? 'gal' : 'scr')} ${s.name}`)

if (PLAN) process.exit(0)

// edit back to front so earlier offsets stay valid
for (const s of [...slots].reverse()) {
  const group = `<g class="sv-glow" data-glow="${s.name}">${GLOW[s.name]}</g>`
  h = h.slice(0, s.closeAt) + group + h.slice(s.closeAt)
}

// Prove it: every screen sprite now ends with its own glow group before </svg>.
let withGlow = 0
for (const m of h.matchAll(/<svg\b[^>]*class="spr"[^>]*viewBox="0 0 16 16"[^>]*>([\s\S]*?)<\/svg>/g)) {
  if (/<g class="sv-glow" data-glow="[^"]+">/.test(m[1])) withGlow++
}
if (withGlow !== 21) throw new Error(`after insertion only ${withGlow}/21 sprites carry a glow`)

// ─── 2. CSS in both copies ───────────────────────────────────────────────────
const CSS_ANCHOR = '.sv-shake{animation:sv-shake 300ms steps(5)}'
const CSS_ADD = CSS_ANCHOR + '\n.sv-glow{opacity:0;transition:opacity 240ms steps(2)}\n.sv-glowing .sv-glow{opacity:1}'
const cssHits = h.split(CSS_ANCHOR).length - 1
if (cssHits !== 2) throw new Error(`expected the animation rule twice (live + code block), found ${cssHits}`)
h = h.split(CSS_ANCHOR).join(CSS_ADD)

const cssNow = h.split('.sv-glowing .sv-glow{opacity:1}').length - 1
if (cssNow !== 2) throw new Error(`CSS landed ${cssNow} times, expected 2`)

// ─── 3. the battle-turn demo: real sprites + glow on defend ──────────────────
const sprite = (name) =>
  `<svg class="spr" width="${SPR}" height="${SPR}" shape-rendering="crispEdges" viewBox="0 0 16 16">` +
  ART[name] + `<g class="sv-glow" data-glow="${name}">${GLOW[name]}</g></svg>`

const D3_OLD =
  '<div style="display:flex;justify-content:space-between;align-items:flex-end;height:70px">' +
  '<div id="you" style="width:40px;height:56px;background:var(--sv-mint)"></div>' +
  '<div id="foe" style="width:40px;height:56px;background:var(--sv-coral)"></div></div>'
const D3_NEW =
  '<div style="display:flex;justify-content:space-between;align-items:flex-end;height:70px">' +
  `<div id="you" style="position:relative;width:${SPR}px;height:${SPR}px">${sprite(HERO)}</div>` +
  `<div id="foe" style="position:relative;width:${SPR}px;height:${SPR}px">${sprite(FOE)}</div></div>`

const d3Hits = h.split(D3_OLD).length - 1
if (d3Hits !== 1) throw new Error(`expected the demo's colour blocks once, found ${d3Hits}`)
h = h.split(D3_OLD).join(D3_NEW)

const DEMO_OLD =
  "function demo3(){var h=document.getElementById('hp');h.style.transition='none';h.style.width='80%';" +
  "replay('you','sv-lunge');setTimeout(function(){replay('foe','sv-lunge')},reduce?0:450);" +
  "setTimeout(function(){replay('foe','sv-hit');h.style.transition=reduce?'none':'width 500ms steps(8)';h.style.width='62%'},reduce?0:900)}"
// Defend is the demo's move, so the hero glows. 240ms in and 240ms out come from the CSS
// transition; the class toggle is all the script has to do.
const DEMO_NEW =
  "function demo3(){var h=document.getElementById('hp'),y=document.getElementById('you');" +
  "y.classList.remove('sv-glowing');h.style.transition='none';h.style.width='80%';" +
  "replay('you','sv-lunge');y.classList.add('sv-glowing');" +
  "setTimeout(function(){replay('foe','sv-lunge')},reduce?0:450);" +
  "setTimeout(function(){replay('foe','sv-hit');h.style.transition=reduce?'none':'width 500ms steps(8)';h.style.width='62%'},reduce?0:900);" +
  "setTimeout(function(){y.classList.remove('sv-glowing')},reduce?0:1200)}"

const demoHits = h.split(DEMO_OLD).length - 1
if (demoHits !== 1) throw new Error(`expected demo3 verbatim once, found ${demoHits}`)
h = h.split(DEMO_OLD).join(DEMO_NEW)

if (!h.includes("y.classList.add('sv-glowing')")) throw new Error('demo3 does not add the glow')
if (!h.includes("y.classList.remove('sv-glowing')")) throw new Error('demo3 does not clear the glow')

// ─── 4. motion-table row ────────────────────────────────────────────────────
const TBL_ANCHOR =
  '<tr><td>error-shake</td><td>Error screen enter / invalid input</td>' +
  '<td>translateX ±6px, 300ms steps(5), once</td><td>none</td></tr>'
const TBL_ADD = TBL_ANCHOR +
  '<tr><td>glow</td><td>Defend, or an item used</td>' +
  '<td>Gilt rim fades in 240ms and out 240ms, steps(2). The rim is the sprite\'s own outline recoloured, so it needs no extra pixels</td>' +
  '<td>rim shown, no fade</td></tr>'
const tblHits = h.split(TBL_ANCHOR).length - 1
if (tblHits !== 1) throw new Error(`expected the error-shake row once, found ${tblHits}`)
h = h.split(TBL_ANCHOR).join(TBL_ADD)

// ─── balance ───────────────────────────────────────────────────────────────
const open = (h.match(/<svg\b/g) || []).length
const close = (h.match(/<\/svg>/g) || []).length
if (open !== close) throw new Error(`svg tags unbalanced after ship: ${open} open / ${close} close — refusing to write`)
const gOpen = (h.match(/<g\b/g) || []).length
const gClose = (h.match(/<\/g>/g) || []).length
if (gOpen !== gClose) throw new Error(`g tags unbalanced: ${gOpen} open / ${gClose} close — refusing to write`)

if (SHIP) {
  fs.writeFileSync(FILE, h)
  console.log(`\nSHIPPED — 21 sprites glow-wrapped, CSS x2, demo3 updated, motion row added`)
} else {
  fs.mkdirSync('assets-raw', { recursive: true })
  fs.writeFileSync('assets-raw/glow-preview.html', h)
  console.log(`\nPREVIEW written to assets-raw/glow-preview.html (nothing shipped)`)
}
console.log(`svg tags balanced: ${open}/${close} · g tags balanced: ${gOpen}/${gClose}`)
