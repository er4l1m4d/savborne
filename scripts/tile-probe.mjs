// Print chosen tiles as terminal art + dominant colours, so we can name what they look like
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
const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const argRefs = process.argv.slice(2).map((a) => a.split(',').map(Number));
const REFS = argRefs.length ? argRefs : [[8, 8], [10, 1], [9, 3], [9, 1], [9, 0]];
// One global colour legend across every requested tile, so the same letter means
// the same colour in all of them — that is what makes cross-tile comparison readable.
const all = REFS.map(([r, c]) => ({ r, c, g: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
  const p = pxAt(c * 16 + x, r * 16 + y); return p[3] < 128 ? null : hexOf(p);
})) }));
const seen = [...new Set(all.flatMap((t) => t.g.flat().filter(Boolean)))].sort();
const legend = new Map(seen.map((h, i) => [h, LETTERS[i] || '?']));
for (const { r, c, g } of all) {
  console.log(`\n=== r${r} c${c} (tile ${String(r * 12 + c).padStart(4, '0')}) ===`);
  console.log('    ' + [...Array(16).keys()].map((i) => i % 10).join(''));
  g.forEach((row, y) => console.log(String(y).padStart(2, ' ') + ' ' + row.map((v) => v ? legend.get(v) : '.').join('').padEnd(16, ' ')));
}
console.log('\nlegend:', seen.map((h, i) => `${LETTERS[i]}=${h}`).join(' '));
