// Dump arbitrary tiles to a labelled-order PNG contact sheet for inspection: node scripts/tiles-to-png.mjs 8,3 7,1 out.png
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
const pxAt = (x, y) => {
  if (P.ctype === 6) { const i = y * P.stride + x * 4; return [P.out[i], P.out[i + 1], P.out[i + 2], P.out[i + 3]]; }
  if (P.ctype === 2) { const i = y * P.stride + x * 3; return [P.out[i], P.out[i + 1], P.out[i + 2], 255]; }
  const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0];
  return [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255];
};

const args = process.argv.slice(2);
const OUT = args[args.length - 1].endsWith('.png') ? args.pop() : 'assets-raw/probe.png';
const refs = args.map((a) => a.split(',').map(Number));
if (!refs.length) { console.error('usage: node scripts/tiles-to-png.mjs r,c r,c ... [out.png]'); process.exit(1); }

const S = 12, PAD = 16, GW = 16;
const W = PAD + refs.length * (GW * S + PAD);
const H = PAD + GW * S + PAD;
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, rgb) => { const i = (y * W + x) * 4; img[i] = rgb[0]; img[i + 1] = rgb[1]; img[i + 2] = rgb[2]; img[i + 3] = 255; };
refs.forEach(([r, c], ti) => {
  for (let y = 0; y < GW; y++) for (let x = 0; x < GW; x++) {
    const p = pxAt(c * 16 + x, r * 16 + y);
    if (p[3] < 128) { // checker the transparent cells so empty space reads as empty
      if (((x + y) & 8) === 0) put(PAD + ti * (GW * S + PAD) + x * S, PAD + y * S, [30, 40, 38]);
      continue;
    }
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(PAD + ti * (GW * S + PAD) + x * S + dx, PAD + y * S + dy, p);
  }
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.mkdirSync('assets-raw', { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log(OUT, '->', refs.map(([r, c]) => `r${r}c${c}`).join(' '));
