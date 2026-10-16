// Extract 16x16 logical tiles from Shade's sheet_4 (64px cells, 8px margin), run style census
import fs from 'node:fs';
import zlib from 'node:zlib';

function decodePng(buf) {
  let pos = 8; let w, h, ctype, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ctype = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = 4, stride = w * 4;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++]; const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const bpp = 4;
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], cc = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255; }
      cur[x] = v;
    }
  }
  return { w, h, out, stride };
}
const { w, h, out, stride } = decodePng(fs.readFileSync('assets-raw/shade/sheet_4.png'));
const px = (x, y) => { const i = y * stride + x * 4; return [out[i], out[i + 1], out[i + 2], out[i + 3]]; };
const hexOf = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const COLS = 7, ROWS = 6, CELL = 64, M = 8;
// sanity: transparent margins?
console.log(`sheet ${w}x${h}; grid ${COLS}x${ROWS} cells of ${CELL}px, margin ${M}px`);

function tile(col, row) {
  const g = [];
  for (let y = 0; y < 16; y++) { const r = []; for (let x = 0; x < 16; x++) {
    const p = px(M + col * CELL + x * 4 + 2, M + row * CELL + y * 4 + 2);
    r.push(p[3] > 128 ? hexOf(p) : null);
  } g.push(r); }
  return g;
}
// census across whole sheet: dominant dark color = outline language
const census = new Map();
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = px(x, y); if (p[3] > 128) { const k = hexOf(p); census.set(k, (census.get(k) || 0) + 1); } }
const sorted = [...census].sort((a, b) => b[1] - a[1]);
console.log('distinct colors:', sorted.length, '| top 8:', sorted.slice(0, 8).map(([c, n]) => `${c}(${n})`).join(' '));
const darkest = sorted.filter(([c]) => { const n = parseInt(c.slice(1), 16); return ((n >> 16) + (n >> 8 & 255) + (n & 255)) / 3 < 70; })[0];
console.log('darkest dominant (outline):', darkest && darkest[0], '— Kenney outline is #3F2631');

// selected tiles for the C strip + item candidates
const PICKS = {
  'battle': [1, 5],   // row1 c5 dark steel sword
  'ranks':  [4, 5],   // row5 gold frame teal gem (medal stand-in)
  'profile': [0, 2],  // row2 steel chestplate (character stand-in)
  'sword_bronze': [0, 1], 'armor_row': [2, 2], 'chest_wood': [0, 4], 'chest_gold': [3, 4],
  'potion_red': [3, 0], 'gem_frame_red': [0, 5],
};
const outJson = {};
for (const [name, [c, r]] of Object.entries(PICKS)) outJson[name] = tile(c, r);
fs.writeFileSync('assets-raw/shade/tiles.json', JSON.stringify(outJson));
console.log('tiles extracted:', Object.keys(outJson).join(', '));
