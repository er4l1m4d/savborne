// Provenance check for the UI glyph set.
//
// Every pixelarticons-sourced glyph in assets/glyphs.json must reproduce EXACTLY the pixel
// set implied by its source SVG, filled per <path> with even-odd and unioned across paths.
// This is the check that was missing: the art gate verifies palette, orphans and contrast,
// none of which can see a wrong FILL RULE. Four shipped glyphs had holes chewed into them
// by a single cross-path even-odd pass and every one of those gates stayed green.
//
// Run it alongside art-gates.mjs. Exits non-zero on any drift.
import fs from 'node:fs';

const N = 24;
const G = JSON.parse(fs.readFileSync('assets/glyphs.json', 'utf8'));
// Prefer the vendored, committed copy. `node_modules/pixelarticons` was never a
// declared dependency, so a clean install (or the environment restart that
// exposed this) silently removes it and every glyph reports "SOURCE MISSING".
// The gate must read a source that is in the repo, not an undeclared package.
const SRC = fs.existsSync('assets-raw/pixelarticons/svg')
  ? 'assets-raw/pixelarticons/svg'
  : 'node_modules/pixelarticons/svg';
const key = (x, y) => y * N + x;
const sig = (s) => [...s].sort((a, b) => a - b).join(',');

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
const fillUnion = (ds) => {
  const s = new Set();
  for (const d of ds) {
    const rings = ringsFromPath(d);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let dep = 0; for (const r of rings) if (insideRing(r, x + .5, y + .5)) dep++;
      if (dep % 2 === 1) s.add(key(x, y));
    }
  }
  return s;
};
// the buggy order, kept so the check can prove it would have caught the original defect
const fillSinglePass = (ds) => {
  const rings = ds.flatMap(ringsFromPath), s = new Set();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dep = 0; for (const r of rings) if (insideRing(r, x + .5, y + .5)) dep++;
    if (dep % 2 === 1) s.add(key(x, y));
  }
  return s;
};
const shippedSet = (pathsMarkup) => {
  const ds = [...pathsMarkup.matchAll(/d="([^"]*)"/g)].map((m) => m[1]);
  const s = new Set();
  for (const d of ds) for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g))
    for (let i = 0; i < Number(m[3]); i++) s.add(key(Number(m[1]) + i, Number(m[2])));
  return s;
};

let fail = 0, checked = 0, skipped = 0;
console.log('glyph        source                 paths  shipped  correct  buggy-would-be');
for (const [k, v] of Object.entries(G)) {
  const src = (v.source || '').match(/pixelarticons:([a-z0-9-]+)/)?.[1];
  if (!src) { skipped++; console.log(`${k.padEnd(12)} ${(v.source || '(none)').slice(0, 22).padEnd(22)} — hand-drawn, no source to verify`); continue; }
  if (!fs.existsSync(`${SRC}/${src}.svg`)) { console.log(`${k.padEnd(12)} ${src.padEnd(22)} *** SOURCE MISSING — cannot verify ***`); fail++; continue; }
  const raw = fs.readFileSync(`${SRC}/${src}.svg`, 'utf8');
  const ds = [...raw.matchAll(/d="([^"]*)"/g)].map((m) => m[1]);
  const want = fillUnion(ds), bad = fillSinglePass(ds), got = shippedSet(v.paths);
  checked++;
  const ok = sig(got) === sig(want);
  if (!ok) fail++;
  console.log(`${k.padEnd(12)} ${src.padEnd(22)} ${String(ds.length).padStart(3)}    ${String(got.size).padStart(5)}    ${String(want.size).padStart(5)}    ${String(bad.size).padStart(5)}${sig(bad) === sig(want) ? '' : '  (differs)'}  ${ok ? 'OK' : '*** DRIFT ***'}`);
}
console.log(`\n${checked} verified against source, ${skipped} hand-drawn, ${fail} drift`);
process.exit(fail ? 1 : 0);
