// Nav icon comparison page: A) hand-drawn 12x12  B) Tiny Dungeon tiles  C) CC0 glyph-pack search log
import fs from 'node:fs';
import zlib from 'node:zlib';

// --- tile renderer (same decoder as contact-sheet) ---
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
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : 1;
  const bpp = ctype === 3 ? 1 : ch;
  const stride = w * (ctype === 3 ? 1 : ch);
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
  const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0];
  return [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255];
};
function tileGrid(r, c) {
  const g = [];
  for (let y = 0; y < 16; y++) { const row = []; for (let x = 0; x < 16; x++) {
    const p = pxAt(c * 16 + x, r * 16 + y);
    row.push(p[3] < 128 ? null : hexOf(p));
  } g.push(row); }
  return g;
}
function svgFromGrid(g, size) {
  const byColor = new Map();
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length;) {
    const col = g[y][x];
    if (!col) { x++; continue; }
    let run = 1; while (x + run < g[y].length && g[y][x + run] === col) run++;
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  const paths = [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" style="image-rendering:pixelated">${paths}</svg>`;
}
function tileSvg(r, c, size, remap) {
  const g = tileGrid(r, c);
  if (remap) for (const row of g) for (let i = 0; i < row.length; i++) if (row[i]) row[i] = remap(row[i]);
  return svgFromGrid(g, size);
}
function bTile(k, size, extraMap) {
  const [r, c] = B_TILES[k];
  const base = k === '/home' ? stripWall : (x) => x;
  let g = tileGrid(r, c).map((row) => row.map((v) => (v ? base(v) : null)));
  g = centerContent(g, k);
  if (extraMap) for (const row of g) for (let i = 0; i < row.length; i++) if (row[i]) row[i] = extraMap(row[i]);
  return svgFromGrid(g, size);
}
// center-only normalization: crop content bbox, re-center in 16x16, no scaling (padding report per icon)
function centerContent(g, key) {
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return g;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const ox = Math.floor((16 - w) / 2), oy = Math.floor((16 - h) / 2);
  const out = Array.from({ length: 16 }, () => Array(16).fill(null));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[oy + y][ox + x] = g[y0 + y][x0 + x];
  PAD[key] = { content: `${w}x${h}`, pad: `L${ox} R${16 - ox - w} T${oy} B${16 - oy - h}`, fits12: w <= 12 && h <= 12 };
  return out;
}
const PAD = {};
// --- recolor treatments (declared maps, bible §2b compliant) ---
const lum2 = (hex) => { const n = parseInt(hex.slice(1), 16); const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const IDLE = ['#4B5A56', '#A9B8B2', '#F3EEDD'];    // off → muted → text (inactive tab)
const ACTIVE = ['#25956A', '#6FD0AE', '#69FFD4'];  // pack mint ramp (active tab)
const duotone = (ramp) => (hex) => { const L = lum2(hex); return ramp[L < 0.15 ? 0 : L < 0.5 ? 1 : 2]; };
// product-hue treatment: keep shading structure, snap every color to nearest PRODUCT token (warm-safe, no near-blacks)
const PRODUCT = ['#F3EEDD', '#C9C1A8', '#A9B8B2', '#6FD0AE', '#F2735A', '#FF6A4D', '#FF9C86', '#F6EFD9', '#2E4642', '#4B5A56', '#A8452F', '#0C3B35'];
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const nearestProduct = (hex) => {
  const [r, g, b] = rgb(hex);
  let best = PRODUCT[0], bd = 1e9;
  for (const p of PRODUCT) { const [pr, pg, pb] = rgb(p); const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
};

// --- option A: current hand-drawn icons, lifted verbatim from the handoff's first nav ---
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const NAVORDER = ['/home', '/missions', '/battle', '/ranks', '/profile'];
const hand = {};
for (const m of h.matchAll(/<a href="(\/(?:home|missions|battle|ranks|profile))"(?: aria-current="page")? style="[^"]*">(<svg[\s\S]*?<\/svg>)/g)) {
  if (!hand[m[1]]) hand[m[1]] = m[2];
}
const LABELS = { '/home': 'Home', '/missions': 'Missions', '/battle': 'Battle', '/ranks': 'Ranks', '/profile': 'Profile' };
const B_TILES = { '/home': [2, 5, 'banner r2c5'], '/missions': [7, 5, 'satchel r7c5'], '/battle': [8, 10, 'sword r8c10'], '/ranks': [5, 5, 'plaque r5c5'], '/profile': [7, 1, 'youth head r7c1'] };
// banner tile sits on a stone wall — strip wall colors (declared map: cool grays -> transparent)
const WALL = new Set(['#8B9BB4', '#52607C', '#262B44', '#AAB7CC', '#E4EDF9', '#C0CBDC', '#FFFFFF']);
const stripWall = (hex) => (WALL.has(hex) ? null : hex);

function strip(cells, activeIdx) {
  return `<div class="nav">${cells.map((c, i) => `<div class="tab${i === activeIdx ? ' active' : ''}">${c}<span>${LABELS[NAVORDER[i]]}</span></div>`).join('')}</div>`;
}
function duoStrip(size, mapFor) {
  return strip(NAVORDER.map((k, i) => bTile(k, size, mapFor(i === 0))), 0);
}
const a24 = strip(NAVORDER.map((k) => hand[k] || '?'), 0);
const a48 = strip(NAVORDER.map((k) => (hand[k] || '').replace(/width="\d+" height="\d+"/, 'width="48" height="48"')), 0);
const b24 = strip(NAVORDER.map((k) => bTile(k, 24)), 0);
const b48 = strip(NAVORDER.map((k) => bTile(k, 48)), 0);

// --- option C: Shade 16x16 (CC0) extracted tiles ---
function gridSvg(g, size) {
  const byColor = new Map();
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length;) {
    const col = g[y][x];
    if (!col) { x++; continue; }
    let run = 1; while (x + run < g[y].length && g[y][x + run] === col) run++;
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  const paths = [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" style="image-rendering:pixelated">${paths}</svg>`;
}
let shade = null;
try { shade = JSON.parse(fs.readFileSync('assets-raw/shade/tiles.json', 'utf8')); } catch { }
const C_MAP = { '/home': null, '/missions': null, '/battle': 'battle', '/ranks': 'ranks', '/profile': 'profile' };
const gapBox = (s) => `<div style="width:${s}px;height:${s}px;border:2px dashed #4B5A56;border-radius:2px"></div>`;
const c24 = shade ? strip(NAVORDER.map((k) => { const t = C_MAP[k]; return t ? gridSvg(shade[t], 24) : gapBox(24); }), 0) : '';
const c48 = shade ? strip(NAVORDER.map((k) => { const t = C_MAP[k]; return t ? gridSvg(shade[t], 48) : gapBox(48); }), 0) : '';

fs.writeFileSync('assets-raw/nav-compare.html', `<!doctype html><html><head><meta charset="utf-8"><title>Nav icon comparison — A/B/C</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 14px system-ui;padding:24px;margin:0}
h1{font-size:20px} h2{font-size:16px;color:#A9B8B2;margin-top:36px}
.nav{display:flex;background:#0C1211;border-top:2px solid #C9C1A8;max-width:430px}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 0 12px;color:#A9B8B2;font-size:12px}
.tab.active{color:#6FD0AE;border-bottom:2px solid #6FD0AE}
.zoom{display:flex;gap:24px;align-items:flex-end;background:#151F1D;border:2px solid #2E4642;padding:14px;max-width:430px}
.note{color:#A9B8B2;font-weight:500;max-width:640px} code{color:#6FD0AE}
a{color:#6FD0AE}</style></head><body>
<h1>Nav icons — pick A, B, or C (compare at true 24px first, zoom second)</h1>
<h2>Option A — hand-drawn 12×12 duotone (current in handoff; token colors, mint active)</h2>
${a24}<div style="height:14px"></div>${a48}
<h2>Option B — Tiny Dungeon tiles at nav size (16×16 pack art, mint underline marks active)</h2>
${b24}<div style="height:14px"></div>${b48}
<h2>Option B recolored — token duotone (L<0.15→off/#25956A, L<0.5→muted/#6FD0AE, else text/#69FFD4; Home shown active)</h2>
${duoStrip(24, (act) => duotone(act ? ACTIVE : IDLE))}<div style="height:14px"></div>${duoStrip(48, (act) => duotone(act ? ACTIVE : IDLE))}
<h2>Option B recolored — product hues, shading kept (every color snapped to nearest product token; Home shown active = mint-tinted)</h2>
${duoStrip(24, (act) => (hex) => act ? nearestProduct(hex === '#E84537' || hex === '#FF706D' ? '#6FD0AE' : hex) : nearestProduct(hex))}<div style="height:14px"></div>${duoStrip(48, (act) => (hex) => act ? nearestProduct(hex === '#E84537' || hex === '#FF706D' ? '#6FD0AE' : hex) : nearestProduct(hex))}
<p class="note">B mapping (per user): Home=banner r2c5 (wall chroma-keyed) · Missions=satchel r7c5 (bronze bag — r5c3 was a sign, not a chest) · Battle=sword r8c10 · Ranks=plaque r5c5 · Profile=youth head r7c1. Treatment chosen: <b>token duotone</b> (strip 2).</p>
<table style="border-collapse:collapse;font-size:12px;color:#A9B8B2;margin:10px 0">${Object.entries(PAD).map(function (e) { return '<tr><td style="padding:2px 14px 2px 0">' + e[0] + '</td><td style="padding-right:14px">content ' + e[1].content + '</td><td style="padding-right:14px">pad ' + e[1].pad + '</td><td>' + (e[1].fits12 ? 'fits 12×12 ✓ (≥2px pad)' : 'exceeds 12 — centered, pad &lt; 2px (no downscale allowed)') + '</td></tr>'; }).join('')}</table>
<h2>Option C — Shade "Free 16×16 Assorted RPG Icons" (CC0, author-confirmed) — live tiles from the real sheet</h2>
${c24 ? `${c24}<div style="height:14px"></div>${c48}` : '<p class="note">run scripts/shade-strip.mjs first</p>'}
<p class="note"><b>Coverage: 3/5.</b> Battle = steel sword (row1·c5), Ranks = gold-framed gem as medal (row5·c4), Profile = steel chestplate (row2·c0). <b>Home and Missions have NO tile</b> in this sheet (dashed boxes) — the pack is item-focused; house/scroll glyphs don't exist here.<br>
<b>Style rubric verdict (measured):</b> outline color <code>#070707</code> neutral black vs Kenney's <code>#3F2631</code> warm plum → <b>fails outline-language match</b>; sheet ships flattened on <code>#2E2E2E</code> (chroma-keyed here); 221 colors across the sheet vs Kenney's disciplined 27. Side-by-side with Kenney tiles (option B strip) shows the difference: Shade = high-contrast arcade, Kenney = warm storybook.<br>
<b>Provenance note:</b> tiles extracted from itch.io preview sheet; production adoption requires the actual zip via itch download (one manual click) + license screenshot. Recommended only if you value its crisper item art over family consistency with Tiny Dungeon.</p>
<img src="/assets-raw/shade/sheet_4.png" alt="Shade sheet (source of option C tiles)" style="image-rendering:pixelated;width:464px;border:2px solid #2E4642">
<h2>Search log (option C candidates)</h2>
<p class="note">Searched 2026-10-16 (itch.io CC0 tag + OpenGameArt):<br>
• <b>Shade — "Free 16×16 Assorted RPG Icons"</b> (merchant-shade.itch.io) — <b>CC0, author-confirmed in comments</b>. Strongest candidate; style is dark-outline 16×16, closest to Kenney's language.<br>
• Kyrise's 16×16 RPG Icon Pack (OGA) — license page inconclusive (login-walled) → fails "verified license" rule.<br>
• Raven Fantasy icons — mixed licensing incl. paid → rejected.<br>
If you lean C: I download Shade's sheet, run it through the same style rubric (outline color, grid, shading) + contrast gate, and add a live "Option C" strip to this page before you finalize.</p>
</body></html>`);
console.log('nav compare -> assets-raw/nav-compare.html (http://localhost:5511/assets-raw/nav-compare.html)');
