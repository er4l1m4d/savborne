// Items batch — build 8 item svgs (4 pack-extracted + 4 hand-drawn to bible) + preview page.
// Does NOT touch Savborne-handoff.html: review first.
import fs from 'node:fs';
import zlib from 'node:zlib';

/* ---------- palette (bible §2, pack colors only) ---------- */
const PAL = {
  k: '#3F2631', d: '#262B44', g: '#52607C', S: '#8B9BB4', s: '#C0CBDC', f: '#FFFFFF',
  u: '#763B36', b: '#BD6C4A', z: '#CF8254', w: '#EAA56C', o: '#F7C282', C: '#E19A65',
  e: '#25956A', m: '#43E1B3', M: '#69FFD4', r: '#E84537', R: '#FF706D',
  Y: '#FEAE34', y: '#FEE761', B: '#0099DB', W: '#75E3FF',
};

/* ---------- pack tile extraction ---------- */
function decodePng(buf) {
  let pos = 8; let w, h, ctype, idat = [];
  const plte = []; let trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ctype = data[9]; }
    else if (type === 'PLTE') { for (let i = 0; i < data.length; i += 3) plte.push([data[i], data[i + 1], data[i + 2]]); }
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ctype === 3 ? 1 : (ctype === 6 ? 4 : 3);
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++]; const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], cc = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255; }
      cur[x] = v;
    }
  }
  return { w, h, ctype, plte, trns, out, stride };
}
const P = decodePng(fs.readFileSync('assets-raw/kenney_tinydungeon/Tilemap/tilemap_packed.png'));
const hexOf = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const pxAt = (x, y) => {
  if (P.ctype === 6) { const i = y * P.stride + x * 4; return [P.out[i], P.out[i + 1], P.out[i + 2], P.out[i + 3]]; }
  if (P.ctype === 2) { const i = y * P.stride + x * 3; return [P.out[i], P.out[i + 1], P.out[i + 2], 255]; }
  const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0];
  return [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255];
};
function tileGrid(r, c) {
  return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
    const p = pxAt(c * 16 + x, r * 16 + y); return p[3] < 128 ? null : hexOf(p);
  }));
}
const recolor = (g, map) => g.map((row) => row.map((v) => (v && map[v] ? map[v] : v)));
const STEEL_TO_BRONZE = { '#C0CBDC': '#F7C282', '#8B9BB4': '#EAA56C', '#52607C': '#CF8254', '#262B44': '#BD6C4A' };

/* ---------- hand-drawn items (pack palette, light source top-left) ---------- */
const fix = (rows, name) => {
  rows.forEach((r, i) => { if (r.length !== 16) console.warn(`!! ${name} row ${i} is ${r.length} wide: '${r}'`); });
  const W = 16;
  return rows.map((r) => (r.length === W ? r : r.length > W ? r.slice(0, W) : r.padEnd(W, '.')));
};
const GRID = {
  'Cloth Purse': fix([
    '................',
    '......k..k......',
    '......k..k......',
    '.....k....k.....',
    '.....kkkkkk.....',
    '....kCCCCCCk....',
    '...kooooooCk....',
    '..koooooooCCk...',
    '..koooooooCCbk..',
    '..koooooooCCbk..',
    '..koooooooCCbk..',
    '...koooooCCbk...',
    '....kbbbCCbk....',
    '.....kbbbbk.....',
    '......kkkk......',
    '................',
  ], 'pouch'),
  'Ledger Tome': fix([
    '................',
    '..kkkkkkkkkkkk..',
    '..kwwwwwwwwwwo..',
    '..kbCCCCCCCwwo..',
    '..kbCyyyyyyCwo..',
    '..kbCCCCCCCwwo..',
    '..kbCCrrrCCwwo..',
    '..kbCCrrrCCwyo..',
    '..kbCCCCCCCwwo..',
    '..kbCCCCCCCwwo..',
    '..kbCCCCCCCwwo..',
    '..kubbbbbbbbuo..',
    '..kkkkkkkkkkkk..',
    '...oooooooooo...',
    '................',
    '................',
  ], 'tome'),
  'Silver Charm': fix([
    '................',
    '......sSSs......',
    '.....ss..ss.....',
    '.....s.ss.s.....',
    '....ssssssss....',
    '...sssMMMMsss...',
    '..ssMMmmmmMMss..',
    '..sMMmmmmmmMMs..',
    '..sMmmmmmmmMMs..',
    '..sMmmmmmeeeMs..',
    '...sMmeeeeeMs...',
    '....ssMeeeSs....',
    '.....ssSSSs.....',
    '.......s........',
    '................',
    '................',
  ]),
  'Gold Gauntlet': fix([
    '................',
    '................',
    '...yy..yy..yy...',
    '...yY..yY..yY...',
    '...yY..yY..yY...',
    '...yY..yY..yY...',
    '.yyyYYYYyyyYYY..',
    '.yYYYYYYYYYYYb..',
    '.yYYYYYYYYYYYb..',
    '..yyyyyyyyyy....',
    '..yYYYYYYYYYb...',
    '..bbbbbbbbbbb...',
    '...kkkkkkkkk....',
    '................',
    '................',
    '................',
  ]),
  'Golden Crown': [],
};
/* Golden Crown v2 — programmatic: solid 3-point + pearls, dilated outline, per-column gold ramp, gem inlays */
function buildCrown() {
  const shape = new Set();
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) shape.add(x + ',' + y); };
  rect(6, 3, 9, 6); rect(2, 5, 4, 6); rect(11, 5, 13, 6);        // spikes
  rect(7, 1, 8, 2); rect(2, 3, 3, 4); rect(12, 3, 13, 4);        // pearl stems above tips
  rect(2, 7, 13, 11);                                            // band
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  for (const key of shape) {
    const [x, y] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < 16 && ny >= 0 && ny < 16 && !shape.has(nx + ',' + ny)) g[ny][nx] = 'k';
    }
  }
  const cols = {};
  for (const key of shape) { const [x, y] = key.split(',').map(Number); (cols[x] = cols[x] || []).push(y); }
  for (const key of shape) {
    const [x, y] = key.split(',').map(Number);
    const ys = cols[x].sort((a, b) => a - b);
    let ch;
    if (y === ys[0]) ch = 'y';                       // top of column: light gold
    else if (y >= 10) ch = 'b';                      // band base: shadow
    else if (y >= 8 && (x === 2 || x === 13)) ch = 'b';
    else ch = 'Y';                                   // body: mid gold
    g[y][x] = ch;
  }
  // gems: symmetric on band rows 8-9 — center red 2x2, side blues at c4/c11 (mirror about 7.5), sparkle top-left
  g[8][7] = 'R'; g[8][8] = 'r'; g[9][7] = 'r'; g[9][8] = 'r';
  g[8][4] = 'W'; g[9][4] = 'B'; g[8][11] = 'W'; g[9][11] = 'B';
  return g.map((row) => row.join(''));
}
GRID['Golden Crown'] = buildCrown();
/* Gold Gauntlet v3 — structural: back-of-hand armor, zones top-to-bottom:
   tapered segmented fingers -> knuckle guard w/ rivets -> metacarpal plate w/ central gem
   -> side thumb -> flared banded cuff w/ steel buckle. Light source top-left per plate. */
function buildGauntlet() {
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  const set = (x, y, ch) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = ch; };
  // --- fingers: 2px wide, arched tips, joint line, dark grooves between ---
  const fingers = [{ x: 3, top: 2 }, { x: 6, top: 1 }, { x: 9, top: 2 }, { x: 12, top: 3 }];
  for (const f of fingers) {
    set(f.x, f.top, 'k'); set(f.x + 1, f.top, 'k');                 // rounded cap
    for (let y = f.top + 1; y <= 5; y++) {
      set(f.x - 1, y, 'k'); set(f.x + 2, y, 'k');                   // grooves/outlines
      set(f.x, y, y === 4 ? 'u' : 'y');                             // lit left col, joint at r4
      set(f.x + 1, y, y === 4 ? 'u' : 'Y');                         // mid right col
    }
  }
  // --- knuckle guard (row 6): lit band + steel rivets under each finger ---
  set(1, 6, 'k'); set(14, 6, 'k');
  for (let x = 2; x <= 13; x++) set(x, 6, 'y');
  [3, 6, 9, 12].forEach((x) => { set(x, 6, 'S'); set(x + 1, 6, 's'); });
  // --- metacarpal plate rows 7-10, thumb left cols 0-1 ---
  for (let y = 7; y <= 9; y++) { set(0, y, 'k'); set(1, y, y === 7 ? 'y' : y === 8 ? 'Y' : 'b'); }  // thumb
  for (let y = 7; y <= 9; y++) {
    set(2, y, 'k'); set(14, y, 'k');
    for (let x = 3; x <= 13; x++) set(x, y, y === 7 ? 'y' : 'Y');
  }
  // central gem setting on the plate (rows 8-9, cols 7-9)
  set(7, 8, 'R'); set(8, 8, 'r'); set(9, 8, 'u');
  set(7, 9, 'r'); set(8, 9, 'u'); set(9, 9, 'u');
  // plate under-shadow row 10
  set(2, 10, 'k'); set(14, 10, 'k');
  for (let x = 3; x <= 13; x++) set(x, 10, 'b');
  // --- flared cuff rows 11-13 + base ---
  set(1, 11, 'k'); set(15, 11, 'k'); for (let x = 2; x <= 14; x++) set(x, 11, 'y');   // lit rim, wider
  set(1, 12, 'k'); set(15, 12, 'k'); for (let x = 2; x <= 14; x++) set(x, 12, 'Y');
  set(7, 12, 's'); set(8, 12, 'S');                                                   // steel buckle
  set(1, 13, 'k'); set(15, 13, 'k'); for (let x = 2; x <= 14; x++) set(x, 13, 'b');   // shadow band
  for (let x = 2; x <= 14; x++) set(x, 14, 'k');                                       // base outline
  return g.map((row) => row.join(''));
}
GRID['Gold Gauntlet'] = buildGauntlet();
/* Bronze Shield v2 — programmatic heater shield: curved silhouette, lit rim left/top + dark rim right/bottom,
   field gradient, central bronze boss w/ cream highlight, 4 rim studs */
function buildShield() {
  const span = { 1: [3, 12], 2: [2, 13], 3: [2, 13], 4: [2, 13], 5: [2, 13], 6: [2, 13], 7: [3, 12], 8: [3, 12], 9: [4, 11], 10: [4, 11], 11: [5, 10], 12: [6, 9], 13: [7, 8] };
  const shape = new Set();
  for (const [y, [a, b]] of Object.entries(span)) for (let x = a; x <= b; x++) shape.add(x + ',' + y);
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  for (const key of shape) {
    const [x, y] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < 16 && ny >= 0 && ny < 16 && !shape.has(nx + ',' + ny)) g[ny][nx] = 'k';
    }
  }
  for (const [ys, [a, b]] of Object.entries(span)) {
    const y = +ys;
    for (let x = a; x <= b; x++) {
      let ch;
      if (y === 1 || x === a) ch = 'w';                       // lit top + left rim
      else if (x === b || y === 13 || (y >= 9 && x > (a + b) / 2)) ch = 'b';  // dark right/bottom rim
      else if (y >= 9 && x <= (a + b) / 2) ch = 'z';
      else ch = (x + y) % 5 === 0 ? 'o' : 'z';                // field: mid bronze, sparse light
      g[y][x] = ch;
    }
  }
  // central boss 3x3 (rows 5-7, cols 6-8): lit ring top-left, cream center, deep shadow bottom-right
  g[5][6] = 'w'; g[5][7] = 'w'; g[5][8] = 'z';
  g[6][6] = 'w'; g[6][7] = 'o'; g[6][8] = 'b';
  g[7][6] = 'z'; g[7][7] = 'u'; g[7][8] = 'u';
  // rim studs: lit dots top corners + waist
  g[2][3] = 'o'; g[2][12] = 'w'; g[7][4] = 'o'; g[7][11] = 'w';
  return g.map((row) => row.join(''));
}
const BRONZE_SHIELD_V2 = buildShield();
/* Copper Compass v2 — programmatic: true circle, 2px ring, bold needle, top loop */
function buildCompass() {
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  const cx = 7.5, cy = 9;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= 4.6) g[y][x] = (x >= 8 && y >= 10) ? 'C' : 'o';
    else if (d <= 6.4) g[y][x] = (y < 9 && x < 8) ? 'w' : (y > 11 ? 'b' : 'z');
    else if (d <= 7.4) g[y][x] = 'k';
  }
  g[1][7] = 'k'; g[1][8] = 'k'; g[2][6] = 'k'; g[2][9] = 'k'; g[2][7] = 'o'; g[2][8] = 'o';
  [[9, 6], [10, 6], [9, 7], [10, 7], [8, 5], [9, 5]].forEach(([x, y]) => { g[y][x] = 'r'; });
  [[6, 11], [5, 12], [6, 12], [7, 10]].forEach(([x, y]) => { g[y][x] = 'S'; });
  [[7, 8], [8, 8], [7, 9], [8, 9]].forEach(([x, y]) => { g[y][x] = 'k'; });
  return g.map((row) => row.join(''));
}
GRID['Copper Compass'] = buildCompass();
function gridToPaths(rows) {
  const H = rows.length, W = rows[0].length;
  const byColor = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    const ch = rows[y][x];
    if (ch === '.' || !PAL[ch]) { x++; continue; }
    let run = 1; while (x + run < W && rows[y][x + run] === ch) run++;
    if (!byColor.has(PAL[ch])) byColor.set(PAL[ch], []);
    byColor.get(PAL[ch]).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`).join('');
}
function gridHexToPaths(g) {
  const byColor = new Map();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16;) {
    const col = g[y][x];
    if (!col) { x++; continue; }
    let run = 1; while (x + run < 16 && g[y][x + run] === col) run++;
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`).join('');
}

/* ---------- assemble the 8 ---------- */
const ITEMS = [
  { name: 'Cloth Purse', src: 'hand-drawn drawstring pouch (cloth ramps)', paths: gridToPaths(GRID['Cloth Purse']) },
  { name: 'Ledger Tome', src: 'hand-drawn closed tome w/ gold band + gem (renamed from \u201cLedger Scroll\u201d \u2014 user sign-off 2026-10-16)', paths: gridToPaths(GRID['Ledger Tome']) },
  { name: 'Bronze Shield', src: 'programmatic v2: heater shape, lit/dark rims, boss + studs (replaces r8c6 flat recolor)', paths: gridToPaths(BRONZE_SHIELD_V2) },
  { name: 'Copper Compass', src: 'hand-drawn v2: true ring, bold needle, loop', paths: gridToPaths(GRID['Copper Compass']) },
  { name: 'Silver Blade', src: 'sword r8c10 (pack)', paths: gridHexToPaths(tileGrid(8, 10)) },
  { name: 'Silver Charm', src: 'hand-drawn, bible ramps', paths: gridToPaths(GRID['Silver Charm']) },
  { name: 'Gold Gauntlet', src: 'programmatic v2: fingers+thumb+palm+cuff, gold ramp, steel knuckles, cuff gem', paths: gridToPaths(GRID['Gold Gauntlet']) },
  { name: 'Golden Crown', src: 'programmatic v2: 3-point + pearls, symmetric gems', paths: gridToPaths(GRID['Golden Crown']) },
];
const svgAt = (it, size) => `<svg width="${size}" height="${size}" viewBox="0 0 16 16" role="img" aria-label="${it.name}">${it.paths}</svg>`;
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/items.json', JSON.stringify(Object.fromEntries(ITEMS.map((it) => [it.name, it.paths]))));

/* preview page */
const cells = ITEMS.map((it) => `
<div class="card">
  <div class="row">${svgAt(it, 64)}${svgAt(it, 16)}<div class="sil">${silhouette(it)}</div></div>
  <b>${it.name}</b><span>${it.src}</span>
</div>`).join('');
function silhouette(it) {
  // flood-to-solid preview: reuse paths but force fill
  return `<svg width="64" height="64" viewBox="0 0 16 16" style="opacity:.9">${it.paths.replace(/fill="[^"]*"/g, 'fill="#3F2631"').replace(/shape-rendering="crispEdges" /g, '')}</svg>`;
}
fs.writeFileSync('assets-raw/items-preview.html', `<!doctype html><html><head><meta charset="utf-8"><title>Items batch — review before handoff</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 14px system-ui;padding:24px;margin:0}h1{font-size:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.card{background:#151F1D;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:14px;display:flex;flex-direction:column;gap:8px}
.row{display:flex;align-items:center;gap:14px}
.card span{color:#A9B8B2;font-size:12px;font-weight:500}
.sil{border:1px dashed #4B5A56;padding:2px}
.note{color:#A9B8B2;max-width:720px}</style></head><body>
<h1>Items batch — 4 pack tiles + 4 hand-drawn (pack palette, top-left light)</h1>
<p class="note">Each card: 64px (4×), 16px (1× — the honest size test), and the flood-to-solid silhouette. Bronze Shield = r8c6 with the declared steel→bronze map. Nothing is in the handoff yet — approve, or name what to rework.</p>
<div class="grid">${cells}</div>
</body></html>`);
/* temp file for gates */
fs.writeFileSync('assets-raw/items-temp.html', `<html><body>${ITEMS.map((it) => svgAt(it, 36)).join('\n')}</body></html>`);
console.log(ITEMS.map((i) => `${i.name}  <-  ${i.src}`).join('\n'));
console.log('preview: http://localhost:5511/assets-raw/items-preview.html');
