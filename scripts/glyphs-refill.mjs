// Re-ship the four glyphs whose path data was wrong.
//
// glyphs-24.mjs used to run one even-odd pass over every ring from every <path>, which let
// a second path carve holes in the first. Four shipped glyphs lost pixels: leave (4),
// useItem (8), flag (8), withdrawal (8). The builder is fixed; the handoff still holds the
// damaged encodings in 29+ instances.
//
// Matching is by PIXEL SET, not by string: an instance is rewritten only when its painted
// pixels are exactly the old buggy set for one of the four. Each instance keeps its own
// fill, because they are not all the same colour.
import fs from 'node:fs';

const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');
const N = 24;
const G = JSON.parse(fs.readFileSync('assets/glyphs.json', 'utf8'));
const SRC = 'node_modules/pixelarticons/svg';
const FIX = ['leave', 'useItem', 'flag', 'withdrawal'];

const key = (x, y) => y * N + x;
function rectSet(d) {
  const s = new Set();
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    const x = Number(m[1]), y = Number(m[2]), w = Number(m[3]);
    for (let i = 0; i < w; i++) s.add(key(x + i, y));
  }
  return s;
}
function setToRects(s) {
  const byRow = new Map();
  for (const k of s) {
    const y = Math.floor(k / N), x = k % N;
    if (!byRow.has(y)) byRow.set(y, new Set());
    byRow.get(y).add(x);
  }
  const out = [];
  for (const y of [...byRow.keys()].sort((a, b) => a - b)) {
    const xs = [...byRow.get(y)].sort((a, b) => a - b);
    let start = xs[0], len = 1;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === start + len) { len++; continue; }
      out.push(`M${start} ${y}h${len}v1h-${len}z`);
      start = xs[i]; len = 1;
    }
    out.push(`M${start} ${y}h${len}v1h-${len}z`);
  }
  return out;
}

// ── rebuild old-buggy and new-correct pixel sets for the four ─────────────
function ringsFromPath(d) {
  const cmds = [];
  for (const m of d.matchAll(/([MmHhVvZz])([^MmHhVvZz]*)/g)) cmds.push([m[1], (m[2].match(/-?\d*\.?\d+/g) || []).map(Number)]);
  const rings = [];
  let cx = 0, cy = 0, sx = 0, sy = 0, pts = [];
  const flush = () => { if (pts.length > 2) rings.push(pts.slice()); pts = []; };
  for (const [c, ns] of cmds) {
    if (c === 'M' || c === 'm') { flush(); if (c === 'm') { cx += ns[0]; cy += ns[1]; } else { cx = ns[0]; cy = ns[1]; } sx = cx; sy = cy; pts = [[cx, cy]]; for (let i = 2; i + 1 < ns.length; i += 2) { cx = ns[i]; cy = ns[i + 1]; pts.push([cx, cy]); } }
    else if (c === 'H') for (const n of ns) { cx = n; pts.push([cx, cy]); }
    else if (c === 'h') for (const n of ns) { cx += n; pts.push([cx, cy]); }
    else if (c === 'V') for (const n of ns) { cy = n; pts.push([cx, cy]); }
    else if (c === 'v') for (const n of ns) { cy += n; pts.push([cx, cy]); }
    else if (c === 'Z' || c === 'z') { pts.push([sx, sy]); flush(); cx = sx; cy = sy; }
  }
  flush(); return rings;
}
const insideRing = (ring, px, py) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const sig = (s) => [...s].sort((a, b) => a - b).join(',');

// Round-trip self-test BEFORE any mutation. setToRects is the one function that can
// silently corrupt art — a mis-packed run paints pixels that were never there.
for (const gk of Object.keys(G)) {
  const ds = [...G[gk].paths.matchAll(/d="([^"]*)"/g)].map((m) => m[1]);
  const original = rectSet(ds.join(''));
  const repacked = rectSet(setToRects(original).join(''));
  if (sig(original) !== sig(repacked)) throw new Error(`round-trip FAILED for ${gk}: ${original.size} -> ${repacked.size} px`);
}
console.log(`round-trip: setToRects(rectSet(x)) === x for all ${Object.keys(G).length} glyphs`);

const targets = [];
for (const gk of FIX) {
  const src = G[gk].source.match(/pixelarticons:([a-z0-9-]+)/)[1];
  const raw = fs.readFileSync(`${SRC}/${src}.svg`, 'utf8');
  const ds = [...raw.matchAll(/d="([^"]*)"/g)].map((m) => m[1]);
  const allRings = ds.flatMap(ringsFromPath);                       // the BUGGY way
  const buggy = new Set();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let d = 0; for (const r of allRings) if (insideRing(r, x + .5, y + .5)) d++;
    if (d % 2 === 1) buggy.add(key(x, y));
  }
  const correct = rectSet(G[gk].paths.match(/d="([^"]*)"/g).map((m) => m.slice(3, -1)).join(''));
  if (sig(buggy) === sig(correct)) { console.log(`${gk}: buggy and correct are identical — nothing to fix`); continue; }
  targets.push({ gk, buggy, correct, lost: correct.size - buggy.size });
  console.log(`${gk.padEnd(10)} buggy ${String(buggy.size).padStart(3)}px  correct ${String(correct.size).padStart(3)}px  lost ${correct.size - buggy.size}`);
}

// ── rewrite matching instances ────────────────────────────────────────────
const svgRe = /<svg\b[^>]*viewBox="0 0 24 24"[^>]*>(?:(?!<\/svg>)[\s\S])*<\/svg>/g;
const matches = [...h.matchAll(svgRe)];
console.log(`\n24x24 svgs in the doc: ${matches.length}`);
const edits = [];
for (const m of matches) {
  const tag = m[0];
  const ds = [...tag.matchAll(/d="([^"]*)"/g)].map((x) => x[1]);
  if (!ds.length) continue;
  const set = rectSet(ds.join(''));
  for (const t of targets) {
    if (sig(set) !== sig(t.buggy)) continue;
    const fill = (tag.match(/fill="([^"]*)"/) || [, 'currentColor'])[1];
    const rects = setToRects(t.correct);
    const inner = `<path fill="${fill}" shape-rendering="crispEdges" d="${rects.join('')}"></path>`;
    const open = tag.slice(0, tag.indexOf('>') + 1);
    edits.push({ at: m.index, len: tag.length, text: `${open}${inner}</svg>`, gk: t.gk });
    break;
  }
}
const perGlyph = {};
for (const e of edits) perGlyph[e.gk] = (perGlyph[e.gk] || 0) + 1;
console.log(`instances to rewrite: ${edits.length}  ${JSON.stringify(perGlyph)}`);

if (!edits.length) { console.log('nothing matched — done'); process.exit(0); }
if (DRY) { console.log('--plan: nothing written'); process.exit(0); }

// back to front so indices stay valid
edits.sort((a, b) => b.at - a.at);
for (const e of edits) h = h.slice(0, e.at) + e.text + h.slice(e.at + e.len);

const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
const sv = (h.match(/<svg\b/g) || []).length, svc = (h.match(/<\/svg>/g) || []).length;
if (dv !== dvc) throw new Error(`div mismatch ${dv}/${dvc} — refusing to write`);
if (sv !== svc) throw new Error(`svg mismatch ${sv}/${svc} — refusing to write`);
for (const t of targets) {
  const still = [...h.matchAll(svgRe)].filter((m) => {
    const ds = [...m[0].matchAll(/d="([^"]*)"/g)].map((x) => x[1]);
    return ds.length && sig(rectSet(ds.join(''))) === sig(t.buggy);
  }).length;
  if (still) throw new Error(`${still} instance(s) of ${t.gk} still carry the buggy set — refusing to write`);
}
fs.writeFileSync(F, h);
console.log(`\nrewrote ${edits.length} instances · div ${dv}/${dvc} · svg ${sv}/${svc} · zero buggy sets remain`);
