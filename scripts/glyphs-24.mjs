// The adopted UI glyph set, on a 24x24 grid — twelve glyphs covering all eleven shapes the
// handoff actually uses, plus the split of crossed-swords into Attack and Ranked.
// Eleven are pixelarticons (MIT) used NATIVELY at their own 24 grid — no resampling.
// `check` is the one hand-drawn exception: their check is a 1px diagonal that fails our own
// orphan gate at 12 (8 px, all orphans) and reads spindly at 24.
// Emits assets/glyphs.json (path data + provenance), a gate temp, a final-set page and a sheet.
import fs from 'node:fs';
import zlib from 'node:zlib';

const PIX = JSON.parse(fs.readFileSync('assets-raw/pixelarticons/icons.json', 'utf8'));
const N = 24;

// Their paths are axis-aligned outlines (M/h/H/v/V/z, integer coords, no curves). Some
// icons are plain rectangles, but trophy and zap trace complex multi-vertex outlines, so
// each closed subpath is filled as a polygon with an even-odd rule at pixel centres —
// bounding-box fill would smear those into solid blocks.
function ringsFromPath(d) {
  const cmds = [];
  for (const m of d.matchAll(/([MmHhVvZz])([^MmHhVvZz]*)/g)) cmds.push([m[1], (m[2].match(/-?\d*\.?\d+/g) || []).map(Number)]);
  const rings = [];
  let cx = 0, cy = 0, sx = 0, sy = 0, pts = [];
  const flush = () => { if (pts.length > 2) rings.push(pts.slice()); pts = []; };
  for (const [c, ns] of cmds) {
    if (c === 'M' || c === 'm') {
      flush();
      if (c === 'm') { cx += ns[0]; cy += ns[1]; } else { cx = ns[0]; cy = ns[1]; }
      sx = cx; sy = cy; pts = [[cx, cy]];
      for (let i = 2; i + 1 < ns.length; i += 2) { cx = ns[i]; cy = ns[i + 1]; pts.push([cx, cy]); }
    } else if (c === 'H') for (const n of ns) { cx = n; pts.push([cx, cy]); }
    else if (c === 'h') for (const n of ns) { cx += n; pts.push([cx, cy]); }
    else if (c === 'V') for (const n of ns) { cy = n; pts.push([cx, cy]); }
    else if (c === 'v') for (const n of ns) { cy += n; pts.push([cx, cy]); }
    else if (c === 'Z' || c === 'z') { pts.push([sx, sy]); flush(); cx = sx; cy = sy; }
  }
  flush();
  return rings;
}
const inside = (ring, px, py) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
function gridFromPaths(pathsArr) {
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  // Fill each <path> on its own with even-odd, then UNION across paths — which is what
  // SVG does. Running a single even-odd pass over every ring from every path lets a later
  // path carve a hole in an earlier one. Measured against the browser's own raster of the
  // source SVGs, that bug ate 4 pixels from `leave`, and 8 each from `useItem`, `flag` and
  // `withdrawal`. Every single-path glyph was unaffected, which is what isolated the cause.
  for (const d of pathsArr) {
    const rings = ringsFromPath(d);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5;
      let depth = 0;
      for (const r of rings) if (inside(r, px, py)) depth++;
      if (depth % 2 === 1) g[y][x] = 1;
    }
  }
  return g;
}

// hand-drawn check: two 45° arms, 2px thick, meeting at a vertex
const empty = () => Array.from({ length: N }, () => Array(N).fill(0));
const stamp2 = (g, x, y) => { for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (g[y + oy]?.[x + ox] !== undefined) g[y + oy][x + ox] = 1; };
function arm(g, x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) stamp2(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n));
}
function buildCheck() {
  const g = empty();
  arm(g, 3, 11, 8, 16);    // short arm down to the vertex
  arm(g, 8, 16, 19, 5);    // long arm up to the tip
  return g;
}

const SET = {
  back: { g: gridFromPaths(PIX.icons['chevron-left']), source: 'pixelarticons:chevron-left (MIT)' },
  check: { g: buildCheck(), source: 'hand-drawn to bible (pixelarticons check fails the gate at every size we use)' },
  lock: { g: gridFromPaths(PIX.icons['lock']), source: 'pixelarticons:lock (MIT)' },
  leave: { g: gridFromPaths(PIX.icons['logout']), source: 'pixelarticons:logout (MIT)' },
  defend: { g: gridFromPaths(PIX.icons['shield']), source: 'pixelarticons:shield (MIT)' },
  useItem: { g: gridFromPaths(PIX.icons['backpack']), source: 'pixelarticons:backpack (MIT)' },
  flag: { g: gridFromPaths(PIX.icons['flag']), source: 'pixelarticons:flag (MIT) — report / forfeit' },
  attack: { g: gridFromPaths(PIX.icons['sword']), source: 'pixelarticons:sword (MIT) — the Attack action' },
  ranked: { g: gridFromPaths(PIX.icons['trophy']), source: 'pixelarticons:trophy (MIT) — Ranked rows; the old crossed-swords X read as a close button' },
  friend: { g: gridFromPaths(PIX.icons['users']), source: 'pixelarticons:users (MIT) — Challenge a friend' },
  special: { g: gridFromPaths(PIX.icons['zap']), source: 'pixelarticons:zap (MIT) — Special Move; replaces a crown-shaped glyph that collided with the Golden Crown item' },
  withdrawal: { g: gridFromPaths(PIX.icons['arrow-right']), source: 'pixelarticons:arrow-right (MIT) — outgoing transaction on the withdrawal screen' },
  // the last two marks off the dead 8x8 grid. Both were hand-drawn there; `Warning` was
  // failing the gate at -Infinity:1, i.e. it painted nothing the gate could see.
  update: { g: gridFromPaths(PIX.icons['arrow-up']), source: 'pixelarticons:arrow-up (MIT) — update available' },
  alert: { g: gridFromPaths(PIX.icons['square-alert']), source: 'pixelarticons:square-alert (MIT) — warning; no alert-triangle exists in the free set' },
};

const isOn = (v) => v === 1;
function paths(g, fill) {
  const ds = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N;) {
    if (!isOn(g[y][x])) { x++; continue; }
    let run = 1; while (x + run < N && isOn(g[y][x + run])) run++;
    ds.push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return `<path fill="${fill}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`;
}
function orphans(g) {
  const list = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!isOn(g[y][x])) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isOn(g[y + dy]?.[x + dx] ?? 0))) list.push(`${x},${y}`);
  }
  return list;
}
const bbox = (g) => {
  const on = [];
  g.forEach((row, y) => row.forEach((v, x) => v && on.push([x, y])));
  const xs = on.map((p) => p[0]), ys = on.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

const out = {};
console.log('glyph     painted   bbox (w x h)        padding L/R/T/B    orphans   source');
for (const [name, s] of Object.entries(SET)) {
  const b = bbox(s.g), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, o = orphans(s.g);
  const n = s.g.flat().filter(isOn).length;
  out[name] = { viewBox: `0 0 ${N} ${N}`, paths: paths(s.g, 'currentColor'), source: s.source };
  console.log(`${name.padEnd(8)} ${String(n).padStart(5)}px   ${`${b.x0}..${b.x1} x ${b.y0}..${b.y1}`.padEnd(16)} ${String(w).padStart(2)}x${String(h).padEnd(2)}  ${b.x0}/${23 - b.x1}/${b.y0}/${23 - b.y1}`.padEnd(18) + `  ${String(o.length).padStart(2)}          ${s.source.slice(0, 34)}`);
  if (o.length) console.log(`         orphan px: ${o.join(' ')}`);
}
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/glyphs.json', JSON.stringify(out, null, 2));
fs.writeFileSync('assets-raw/glyphs24-temp.html', `<html><body>${Object.entries(SET).map(([k, s]) => `<svg width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="${k}">${paths(s.g, '#F3EEDD')}</svg>`).join('\n')}</body></html>`);

// final-set page: the adopted six at 48 (2x) and 24 (1x, the in-app size)
const cards = Object.keys(SET).map((k) => `<div class="c"><div class="pair"><svg width="48" height="48" viewBox="0 0 24 24" shape-rendering="crispEdges" style="color:#F3EEDD">${out[k].paths}</svg><svg width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges" style="color:#F3EEDD">${out[k].paths}</svg></div><b>${k}</b><span>${SET[k].source}</span></div>`).join('');
fs.writeFileSync('assets-raw/glyphs-final.html', `<!doctype html><html><head><meta charset="utf-8"><title>Adopted UI glyphs — 24x24</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 14px system-ui;padding:24px;margin:0}h1{font-size:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.c{background:#151F1D;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px}
.pair{display:flex;align-items:flex-end;gap:14px;background:#0E1716;border:2px solid #2E4642;padding:12px}
.c span{color:#A9B8B2;font-size:11px;font-weight:500;text-align:center}
.note{color:#A9B8B2;max-width:840px}</style></head><body>
<h1>Adopted UI glyph set — 24×24 grid</h1>
<p class="note">Eleven of the twelve are <b>pixelarticons, MIT © Gerrit Halfmann</b>, used natively on their own 24×24 grid — no resampling, no re-drawing. <code>check</code> is the one hand-drawn exception because their check is a 1px diagonal that fails our own orphan gate at every size we could use it. Shown at 48px (2×) and 24px (1×, the size the app renders). The MIT text and the verbatim source SVGs are vendored at <code>assets-raw/pixelarticons/</code>.</p>
<div class="grid">${cards}</div>
</body></html>`);
console.log('\nwrote assets/glyphs.json + assets-raw/glyphs24-temp.html + assets-raw/glyphs-final.html');
console.log('final set: http://localhost:5511/assets-raw/glyphs-final.html');

// PNG sheet so the polygon-filled icons (trophy, zap) can be verified by eye
const SS = 5, PP = 14, CCOLS = 6, names = Object.keys(SET);
const CW = PP + CCOLS * (24 * SS + PP), CH = PP + Math.ceil(names.length / CCOLS) * (24 * SS + PP);
const img = Buffer.alloc(CW * CH * 4);
for (let i = 0; i < CW * CH; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { const i = (y * CW + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
names.forEach((k, i) => {
  const g = SET[k].g, cx = PP + (i % CCOLS) * (24 * SS + PP), cy = PP + Math.floor(i / CCOLS) * (24 * SS + PP);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    if (!isOn(g[y][x])) continue;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) put(cx + x * SS + dx, cy + y * SS + dy, [243, 238, 221]);
  }
});
const raw = Buffer.alloc(CH * (CW * 4 + 1));
for (let y = 0; y < CH; y++) { raw[y * (CW * 4 + 1)] = 0; img.copy(raw, y * (CW * 4 + 1) + 1, y * CW * 4, (y + 1) * CW * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(CW, 0); ihdr.writeUInt32BE(CH, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/glyphs24-sheet.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`sheet: assets-raw/glyphs24-sheet.png — row-major, 6 per row: ${names.join(', ')}`);
