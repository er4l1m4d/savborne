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
function tileSvg(r, c, size) {
  const byColor = new Map();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16;) {
    const p = pxAt(c * 16 + x, r * 16 + y);
    if (p[3] < 128) { x++; continue; }
    const col = hexOf(p);
    let run = 1;
    while (x + run < 16) { const q = pxAt(c * 16 + x + run, r * 16 + y); if (q[3] < 128 || hexOf(q) !== col) break; run++; }
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  const paths = [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" style="image-rendering:pixelated">${paths}</svg>`;
}

// --- option A: current hand-drawn icons, lifted verbatim from the handoff's first nav ---
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const NAVORDER = ['/home', '/missions', '/battle', '/ranks', '/profile'];
const hand = {};
for (const m of h.matchAll(/<a href="(\/(?:home|missions|battle|ranks|profile))"(?: aria-current="page")? style="[^"]*">(<svg[\s\S]*?<\/svg>)/g)) {
  if (!hand[m[1]]) hand[m[1]] = m[2];
}
const LABELS = { '/home': 'Home', '/missions': 'Missions', '/battle': 'Battle', '/ranks': 'Ranks', '/profile': 'Profile' };
const B_TILES = { '/home': [6, 9, 'gate r6c9'], '/missions': [10, 10, 'scroll r10c10'], '/battle': [8, 10, 'sword r8c10'], '/ranks': [7, 0, 'wizard-hat r7c0 (contested)'], '/profile': [7, 1, 'youth head r7c1'] };

function strip(cells, activeIdx) {
  return `<div class="nav">${cells.map((c, i) => `<div class="tab${i === activeIdx ? ' active' : ''}">${c}<span>${LABELS[NAVORDER[i]]}</span></div>`).join('')}</div>`;
}
const a24 = strip(NAVORDER.map((k) => hand[k] || '?'), 0);
const a48 = strip(NAVORDER.map((k) => (hand[k] || '').replace(/width="\d+" height="\d+"/, 'width="48" height="48"')), 0);
const b24 = strip(NAVORDER.map((k) => { const [r, c] = B_TILES[k]; return tileSvg(r, c, 24); }), 0);
const b48 = strip(NAVORDER.map((k) => { const [r, c] = B_TILES[k]; return tileSvg(r, c, 48); }), 0);

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
<p class="note">B mapping: Home=gate r6c9 · Missions=scroll r10c10 · Battle=sword r8c10 · Ranks=wizard r7c0 <b>(contested — no crown/trophy tile found; tell me a better one from the contact sheet)</b> · Profile=youth head r7c1. Watch legibility at 24px: pack tiles carry 5–11 colors in 16px; at tab size detail turns to mush — that is the known risk of this option.</p>
<h2>Option C — CC0 pixel glyph packs (search log)</h2>
<p class="note">Searched 2026-10-16 (itch.io CC0 tag + OpenGameArt):<br>
• <b>Shade — "Free 16×16 Assorted RPG Icons"</b> (merchant-shade.itch.io) — <b>CC0, author-confirmed in comments</b>. Strongest candidate; style is dark-outline 16×16, closest to Kenney's language.<br>
• Kyrise's 16×16 RPG Icon Pack (OGA) — license page inconclusive (login-walled) → fails "verified license" rule.<br>
• Raven Fantasy icons — mixed licensing incl. paid → rejected.<br>
If you lean C: I download Shade's sheet, run it through the same style rubric (outline color, grid, shading) + contrast gate, and add a live "Option C" strip to this page before you finalize.</p>
</body></html>`);
console.log('nav compare -> assets-raw/nav-compare.html (http://localhost:5511/assets-raw/nav-compare.html)');
