// Batch 3: replace handoff nav icons with Tiny Dungeon tiles, product-hue treatment (user-approved)
import fs from 'node:fs';
import zlib from 'node:zlib';

/* ---------- pipeline (same math as nav-compare page) ---------- */
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
const tileGrid = (r, c) => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
  const p = pxAt(c * 16 + x, r * 16 + y); return p[3] < 128 ? null : hexOf(p);
}));
const WALL = new Set(['#8B9BB4', '#52607C', '#262B44', '#AAB7CC', '#E4EDF9', '#C0CBDC', '#FFFFFF']);
function centerContent(g) {
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, ox = Math.floor((16 - w) / 2), oy = Math.floor((16 - h) / 2);
  const out = Array.from({ length: 16 }, () => Array(16).fill(null));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[oy + y][ox + x] = g[y0 + y][x0 + x];
  return out;
}
const PRODUCT = ['#F3EEDD', '#C9C1A8', '#A9B8B2', '#6FD0AE', '#F2735A', '#FF6A4D', '#FF9C86', '#F6EFD9', '#2E4642', '#4B5A56', '#A8452F', '#0C3B35'];
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const nearestProduct = (hex) => {
  const [r, g, b] = rgb(hex);
  let best = PRODUCT[0], bd = 1e9;
  for (const p of PRODUCT) { const [pr, pg, pb] = rgb(p); const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
};
const REDS = new Set(['#E84537', '#FF706D']); // active-tab tint (identical to approved page treatment)
function buildSvg(key, active) {
  const T = { home: [2, 5], missions: [7, 5], battle: [8, 10], ranks: [5, 5], profile: [7, 1] }[key];
  let g = tileGrid(T[0], T[1]);
  if (key === 'home') g = g.map((row) => row.map((v) => (v && WALL.has(v) ? null : v)));
  g = centerContent(g);
  g = g.map((row) => row.map((v) => { if (!v) return null; const s = active && REDS.has(v) ? '#6FD0AE' : v; return nearestProduct(s); }));
  const byColor = new Map();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16;) {
    const col = g[y][x]; if (!col) { x++; continue; }
    let run = 1; while (x + run < 16 && g[y][x + run] === col) run++;
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  const paths = [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`).join('');
  return `<svg width="24" height="24" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="image-rendering:pixelated">${paths}</svg>`;
}

/* ---------- replace in handoff ---------- */
let h = fs.readFileSync('Savborne-handoff.html', 'utf8');
let n = 0, nActive = 0;
h = h.replace(/<a href="\/(home|missions|battle|ranks|profile)"( aria-current="page")?\s+style="[^"]*"><svg[\s\S]*?<\/svg>/g,
  (m, key, cur) => { if (cur) nActive++; n++; return m.replace(/<svg[\s\S]*?<\/svg>/, buildSvg(key, !!cur)); });
// Pixel-art section gallery: swap the five nav cards to the new tiles
let g2 = 0;
for (const key of ['home', 'missions', 'battle', 'ranks', 'profile']) {
  const re = new RegExp('<div class="card"[^>]*><svg [^>]*viewBox="0 0 12 12"[^>]*>[\\s\\S]*?</svg><code>' + key + '</code></div>');
  if (re.test(h)) { h = h.replace(re, `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px"><svg width="48" height="48" viewBox="0 0 16 16" style="image-rendering:pixelated">${buildSvg(key, false).match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1]}</svg><code>${key} · TD tile</code></div>`); g2++; }
}
h = h.replace('Nav + glyph icons use <code>currentColor</code>: tabs render <code>muted</code> (off) and <code>mint</code> (active). Never stroke icons, never rounded joins — this replaces the previous line-icon set everywhere, screens included.',
  'Nav icons are Tiny Dungeon tiles (banner r2c5 · satchel r7c5 · sword r8c10 · plaque r5c5 · youth head r7c1), wall-keyed, content-centered, snapped to product hues via the declared nearest-token map; active tab tints warm reds to mint. UI glyphs (back/check/lock/leave/bag/shield) remain hand-drawn <code>currentColor</code> duotone. At DPR 2/3 phone screens the 16→24px render lands on exact device pixels; on desktop previews it may look 1px soft — ship size is mobile.');
fs.writeFileSync('Savborne-handoff.html', h);

/* ---------- manifest ---------- */
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/manifest.json', JSON.stringify({
  generated: '2026-10-16', pack: { name: 'Tiny Dungeon 1.0', author: 'Kenney', license: 'CC0', local: 'assets-raw/kenney_tinydungeon/', licenseFile: 'assets-raw/kenney_tinydungeon/License.txt' },
  nav: {
    home: { tile: 'r2c5', maps: ['wall-chroma-key(#8B9BB4,#52607C,#262B44,#AAB7CC,#E4EDF9,#C0CBDC,#FFFFFF→transparent)', 'center-bbox', 'nearestProductHue', 'active: reds→#6FD0AE'] },
    missions: { tile: 'r7c5', maps: ['center-bbox', 'nearestProductHue'] },
    battle: { tile: 'r8c10', maps: ['center-bbox', 'nearestProductHue'] },
    ranks: { tile: 'r5c5', maps: ['center-bbox', 'nearestProductHue'] },
    profile: { tile: 'r7c1', maps: ['center-bbox', 'nearestProductHue'] },
  },
  productPalette: PRODUCT,
  display: '24px CSS (1.5x; exact on DPR2+)',
}, null, 2));
console.log(`nav svgs replaced: ${n} (${nActive} active) | gallery cards: ${g2} | manifest written`);
