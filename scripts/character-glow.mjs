// Build the reserved `glow` channel: a gilt (gold) inner rim per character.
//
// Art bible §4 defines glow as "an effect has been applied to this fighter" — used identically
// for defend and item-use, one meaning, one treatment.
//
// The bible's original recipe ("1px rim #FEE761, 8-neighbour silhouette") CANNOT be baked on
// the 16x16 character grid. Measured against the shipped assets: 10 of 12 characters touch the
// frame edge so an outward rim has only 6-10 cells of room, and Rival · Hooded Miser and
// Rival · Cutpurse fill the frame corner-to-corner and have ZERO room. A pre-baked outward rim
// needs pixels that do not exist. See ERRORS.md.
//
// So the rim is drawn INWARD: the sprite's own outermost outline pixels are recoloured. Those
// pixels already exist on all 12 characters (44-56 each), so this needs no grid change and no
// re-baking of characters.json.
//
// The colour is #3F2631 — the outline the art bible specifies as the single silhouette row.
// It is also used INTERIORLY (30-58 pixels per character: face lines, folds, a belt), so the
// rim is not "every #3F2631 pixel", it is specifically the outline pixels that touch empty
// space. Recolouring the interior ones would turn detail gold.
//
// Output is a separate file, not a change to characters.json: every consumer reads that file as
// `ART[key]` -> a bare SVG string spliced into markup (characters-ship.mjs, arena-floor.mjs,
// turn-states.mjs, blink-test.mjs, ...). Changing the value to an object would break them all.
// The glow is an overlay path drawn ON TOP of the sprite, so the gilt covers the dark outline.
import fs from 'node:fs'

const SRC = 'assets/characters.json'
const OUT = 'assets/character-glows.json'
const N = 16
const OUTLINE = '#3F2631'
const GLOW = '#FEE761'
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

/** Parse the run-form paths into a grid of colours. The art is written as M{x} {y}h{w}v1h-{w}z. */
function gridOf(art) {
  const g = Array.from({ length: N }, () => Array(N).fill(null))
  for (const p of art.matchAll(/fill="(#[0-9A-F]{6})"[^>]*d="([^"]*)"/g)) {
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
      const x = Number(r[1]), y = Number(r[2]), w = Number(r[3])
      for (let i = 0; i < w; i++) g[y][x + i] = p[1]
    }
  }
  return g
}

const at = (g, x, y) => (x < 0 || y < 0 || x >= N || y >= N ? null : g[y][x])
const isEdge = (g, x, y) => NB8.some(([dx, dy]) => at(g, x + dx, y + dy) === null)

/** Outline pixels that touch empty space — the silhouette boundary, and only that. */
function rimOf(g) {
  const out = []
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] === OUTLINE && isEdge(g, x, y)) out.push([x, y])
  }
  return out
}

/** Compress a pixel set into the same run-form the rest of the art uses. */
function toRuns(cells) {
  const byRow = new Map()
  for (const [x, y] of cells) {
    if (!byRow.has(y)) byRow.set(y, [])
    byRow.get(y).push(x)
  }
  const parts = []
  for (const y of [...byRow.keys()].sort((a, b) => a - b)) {
    const xs = byRow.get(y).sort((a, b) => a - b)
    let i = 0
    while (i < xs.length) {
      let j = i
      while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++
      const w = xs[j] - xs[i] + 1
      parts.push(`M${xs[i]} ${y}h${w}v1h-${w}z`)
      i = j + 1
    }
  }
  return parts.join('')
}

const ART = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const names = Object.keys(ART)
if (names.length !== 12) throw new Error(`expected 12 characters, found ${names.length}`)

const out = {}
const report = []
for (const name of names) {
  const g = gridOf(ART[name])
  const filled = g.flat().filter(Boolean).length
  if (filled === 0) throw new Error(`${name}: parsed 0 pixels — the run-form parse failed`)

  const rim = rimOf(g)
  if (!rim.length) throw new Error(`${name}: no inner rim found`)

  // Every rim pixel must be outline, and the rim must not spill into interior detail.
  for (const [x, y] of rim) {
    if (g[y][x] !== OUTLINE) throw new Error(`${name}: rim pixel ${x},${y} is ${g[y][x]}, not the outline`)
    if (!isEdge(g, x, y)) throw new Error(`${name}: rim pixel ${x},${y} is interior, not silhouette`)
  }
  // The overlay must be strictly inside the sprite: a rim cell must never be an empty cell.
  const interiorOutline = []
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] === OUTLINE && !isEdge(g, x, y)) interiorOutline.push([x, y])
  }

  const d = toRuns(rim)
  // Round-trip: re-parse what we emit and prove it is the same pixel set.
  const re = gridOf(`<path fill="${GLOW}" d="${d}"/>`)
  const back = []
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (re[y][x] === GLOW) back.push([x, y])
  const key = (a) => a.map(([x, y]) => `${x},${y}`).sort().join(' ')
  if (key(back) !== key(rim)) throw new Error(`${name}: emitted runs do not match the computed rim`)

  out[name] = `<path fill="${GLOW}" shape-rendering="crispEdges" d="${d}"></path>`
  report.push({ name, rim: rim.length, interiorOutline: interiorOutline.length, runs: (d.match(/M/g) || []).length })
}

if (Object.keys(out).length !== 12) throw new Error('did not emit 12 glows')

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')

console.log('character'.padEnd(20), 'rim px', 'interior outline px (untouched)', 'runs')
for (const r of report) {
  console.log(r.name.padEnd(20), String(r.rim).padStart(6), String(r.interiorOutline).padStart(28), String(r.runs).padStart(5))
}
console.log(`\nwrote ${OUT} — 12 glows, all rim pixels verified outline-and-silhouette, all runs round-trip`)
