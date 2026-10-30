// Which tiles are floors? Answered from Kenney's own sample map rather than by guessing
// at thumbnails: count every GID across the map's layers (strip the flip flags in the high
// bits), rank by frequency, and render the top of the list so the floor set can be picked
// by eye from evidence.
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
const hexOf = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const pxAt = (x, y) => {
  if (P.ctype === 6) { const i = y * P.stride + x * 4; return [P.out[i], P.out[i + 1], P.out[i + 2], P.out[i + 3]]; }
  const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0];
  return [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255];
};

const tmx = fs.readFileSync('assets-raw/kenney_tinydungeon/Tiled/sampleMap.tmx', 'utf8');
const FLIP = { h: 0x80000000, v: 0x40000000, d: 0x20000000 };
const counts = new Map(), flipped = new Map();
for (const layer of tmx.matchAll(/<layer id="\d+" name="([^"]+)"[\s\S]*?<data encoding="csv">([\s\S]*?)<\/data>/g)) {
  const nums = (layer[2].match(/\d+/g) || []).map(Number);   // the CSV only — layer attributes excluded
  for (const gid of nums) {
    if (!gid) continue;                                        // 0 = empty cell
    const idx = (gid & 0xFFFF) - 1;                            // strip flags, GID is 1-based
    flipped.set(idx, ((flipped.get(idx) || 0) + ((gid & FLIP.h) ? 1 : 0)));
    counts.set(idx, (counts.get(idx) || 0) + 1);
  }
}
const ranked = [...counts].sort((a, b) => b[1] - a[1]);
const rc = (i) => `r${Math.floor(i / 12)}c${i % 12}`;
console.log(`${ranked.length} distinct tiles used across the sample map. Most frequent:\n`);
for (const [i, n] of ranked.slice(0, 18)) {
  const cols = new Set();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = pxAt((i % 12) * 16 + x, Math.floor(i / 12) * 16 + y); if (p[3] > 128) cols.add(hexOf(p)); }
  const main = [...cols].sort((a, b) => { const L = (h) => [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16)).reduce((s, v) => s + v, 0); return L(b) - L(a); })[0];
  console.log(`  ${rc(i).padEnd(6)} x${String(n).padStart(3)}  ${cols.size} colours  lightest ${main}`);
}

// contact sheet of the top 18, row-major, 6 per row
const TOP = ranked.slice(0, 18).map(([i]) => i);
const S = 9, PAD = 12, COLS = 6;
const W = PAD + COLS * (16 * S + PAD), H = PAD + Math.ceil(TOP.length / COLS) * (16 * S + PAD);
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
TOP.forEach((t, n) => {
  const cx = PAD + (n % COLS) * (16 * S + PAD), cy = PAD + Math.floor(n / COLS) * (16 * S + PAD);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const p = pxAt((t % 12) * 16 + x, Math.floor(t / 12) * 16 + y);
    if (p[3] < 128) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(cx + x * S + dx, cy + y * S + dy, p);
  }
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/floor-candidates.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`\nsheet (row-major, 6 per row, in the order above):\n  ${TOP.map(rc).join('  ')}`);
