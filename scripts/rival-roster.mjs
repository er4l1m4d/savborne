// Rival roster probe: 5 user-picked tiles -> PNG (for inspection) + review page + gate temp
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
const tileGrid = (r, c) => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
  const p = pxAt(c * 16 + x, r * 16 + y); return p[3] < 128 ? null : hexOf(p);
}));
function paths(g) {
  const byColor = new Map();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16;) {
    const col = g[y][x]; if (!col) { x++; continue; }
    let run = 1; while (x + run < 16 && g[y][x + run] === col) run++;
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`).join('');
}

const SLOTS = [[8, 8], [10, 1], [9, 3], [9, 1], [9, 0]];
const grids = SLOTS.map(([r, c]) => ({ ref: `r${r}c${c}`, n: String(r * 12 + c).padStart(4, '0'), g: tileGrid(r, c) }));

// ---- PNG contact sheet (10x, checker-free dark ground) so the shapes can be inspected ----
const S = 10, PAD = 20, GW = 16;
const W = PAD + grids.length * (GW * S + PAD);
const H = PAD + GW * S + PAD;
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, rgb) => { const i = (y * W + x) * 4; img[i] = rgb[0]; img[i + 1] = rgb[1]; img[i + 2] = rgb[2]; img[i + 3] = 255; };
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
grids.forEach((t, ti) => {
  for (let y = 0; y < GW; y++) for (let x = 0; x < GW; x++) {
    const col = t.g[y][x]; if (!col) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(PAD + ti * (GW * S + PAD) + x * S + dx, PAD + y * S + dy, rgb(col));
  }
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(td) : crc32(td));
  return Buffer.concat([len, td, crc]);
};
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/rival-roster.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));

// ---- review page + gate temp ----
const svg = (t, size) => `<svg width="${size}" height="${size}" viewBox="0 0 16 16" role="img" aria-label="Rival ${t.ref}" style="image-rendering:pixelated">${paths(t.g)}</svg>`;
const cards = grids.map((t) => {
  const colors = [...new Set(t.g.flat().filter(Boolean))];
  return `<div class="card"><div class="row">${svg(t, 128)}${svg(t, 64)}${svg(t, 16)}</div><b>${t.ref}</b><span>tile_${t.n} · ${colors.length} colors: ${colors.join(' ')}</span></div>`;
}).join('');
const arena = `<div class="arena">` + grids.map((t) => `<div class="fighter">${svg(t, 96)}<b>${t.ref}</b></div>`).join('<div class="vs">or</div>') + `</div>`;
fs.writeFileSync('assets-raw/rival-roster.html', `<!doctype html><html><head><meta charset="utf-8"><title>Rival roster — your 5 picks</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 14px system-ui;padding:24px;margin:0}h1{font-size:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.card{background:#151F1D;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px}
.card span{color:#A9B8B2;font-size:11px;font-weight:500;word-break:break-all}
.row{display:flex;align-items:flex-end;gap:14px;background:#0E1716;border:2px solid #2E4642;padding:10px}
.arena{display:flex;gap:14px;align-items:flex-end;background:#101A18;border:2px solid #C9C1A8;padding:20px;margin:22px 0}
.fighter{display:flex;flex-direction:column;gap:6px;align-items:center}
.vs{font:400 14px 'Courier New',monospace;color:#A9B8B2}
.note{color:#A9B8B2;max-width:760px}</style></head><body>
<h1>Rival roster — 5 tiles you picked, as the AI opponent pool</h1>
<p class="note">Each card: 8× (arena size), 4×, 1× (source grid). One of these five shows up as the creature you battle, rolled per battle.</p>
${arena}
<div class="grid">${cards}</div>
</body></html>`);
fs.writeFileSync('assets-raw/rival-roster-temp.html', `<html><body>${grids.map((t) => svg(t, 36)).join('\n')}</body></html>`);
console.log('wrote assets-raw/rival-roster.png + rival-roster.html + rival-roster-temp.html');
