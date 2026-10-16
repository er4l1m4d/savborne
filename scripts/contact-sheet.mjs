// Step 1: labeled contact sheet of all 132 Tiny Dungeon tiles at 8x, with tentative IDs
import fs from 'node:fs';
import zlib from 'node:zlib';

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
const hexOf = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

const P = decodePng(fs.readFileSync('assets-raw/kenney_tinydungeon/Tilemap/tilemap_packed.png'));
const pxAt = (x, y) => {
  if (P.ctype === 6) { const i = y * P.stride + x * 4; return [P.out[i], P.out[i + 1], P.out[i + 2], P.out[i + 3]]; }
  if (P.ctype === 2) { const i = y * P.stride + x * 3; return [P.out[i], P.out[i + 1], P.out[i + 2], 255]; }
  const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0];
  return [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255];
};
const TW = 12, TH = 11;
function tileSvg(r, c) {
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
  return `<svg width="128" height="128" viewBox="0 0 16 16" style="background:#0C1211;border:1px solid #2E4642">${paths}</svg>`;
}
// tentative identities — "?" = must be confirmed by human; blank = environment, not needed
const GUESSES = {
  '0,0': 'scroll (paper) — Ledger Scroll?',
  '6,0': 'flag/banner — badge?', '6,1': 'quill/pen — missions?', '6,3': 'ladder',
  '7,0': 'KING (crown, beard) — Golden Crown / Gold gear?',
  '7,1': 'character head w/ plume', '7,2': 'character head', '7,3': 'character head (mage?)',
  '7,4': 'character head', '7,5': 'character head', '7,6': 'character head', '7,7': 'character head', '7,8': 'character head (11 colors — detail)',
  '8,0': 'full knight A', '8,1': 'full knight B', '8,2': 'full knight C', '8,3': 'full knight D', '8,4': 'full body E',
  '8,5': 'chest/barrel?', '8,6': 'chest/barrel?', '8,7': 'urn?', '8,8': 'urn?',
  '9,0': 'potion green', '9,1': 'potion red', '9,2': 'potion blue', '9,3': 'bomb/orb (ROUND — compass base?)',
  '9,4': 'orb/round', '9,5': 'key', '9,6': 'key', '9,7': 'item?', '9,8': 'item?', '9,9': 'katana?', '9,10': 'item?', '9,11': 'item?',
  '10,0': 'sword?', '10,1': 'sword?', '10,2': 'weapon/tool (8 colors)', '10,3': 'staff?', '10,4': 'axe?',
  '10,5': 'shield?', '10,6': 'shield?', '10,7': 'tool?', '10,8': 'tool?', '10,9': 'misc?', '10,10': 'misc?', '10,11': 'misc?',
};
let cells = '';
for (let r = 0; r < TH; r++) for (let c = 0; c < TW; c++) {
  const idx = String(r * TW + c).padStart(4, '0');
  const g = GUESSES[`${r},${c}`] || '';
  cells += `<div class="cell">${tileSvg(r, c)}<div class="lbl">r${r} c${c} · tile_${idx}</div><div class="guess">${g}</div></div>`;
}
fs.writeFileSync('assets-raw/contact-sheet.html', `<!doctype html><html><head><meta charset="utf-8"><title>Tiny Dungeon — labeled contact sheet</title>
<style>body{background:#0C1211;color:#F3EEDD;font:600 13px system-ui;padding:24px;margin:0}
h1{font-size:20px} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.cell{background:#151F1D;border:2px solid #2E4642;padding:6px;text-align:center}
.lbl{color:#A9B8B2;font-size:11px;margin-top:4px} .guess{color:#6FD0AE;font-size:11px;min-height:14px}
img{border:2px solid #2E4642;image-rendering:pixelated;max-width:480px}
section{margin:20px 0}</style></head><body>
<h1>Tiny Dungeon contact sheet — 132 tiles @ 8× (green = my guess, CONFIRM or correct before use)</h1>
<section><h2>Kenney's own usage references</h2>
<img src="/assets-raw/kenney_tinydungeon/Sample.png" alt="Kenney Sample.png — intended usage"><br>
<img src="/assets-raw/kenney_tinydungeon/Preview.png" alt="Kenney Preview.png"></section>
<section class="grid">${cells}</section>
</body></html>`);
console.log('contact sheet -> assets-raw/contact-sheet.html (open http://localhost:5511/assets-raw/contact-sheet.html)');
