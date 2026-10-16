// Raw-material analysis: decode tilemap PNG (pure node, zlib), extract per-tile + global colors
import fs from 'node:fs';
import zlib from 'node:zlib';

// --- minimal PNG decoder (RGBA8/RGB8, non-interlaced) ---
function decodePng(buf) {
  let pos = 8; let w, h, depth, ctype, idat = [];
  const plte = []; let trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9];
      if (data[7] === 1) throw new Error('interlaced unsupported');
    } else if (type === 'PLTE') {
      for (let i = 0; i < data.length; i += 3) plte.push([data[i], data[i + 1], data[i + 2]]);
    } else if (type === 'tRNS') { trns = data; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 0 ? 1 : 1; // 3=RGB,4=RGBA,2=indexed
  const bpp = ctype === 3 ? 1 : ch;
  const stride = Math.ceil((w * (ctype === 3 ? 8 : ch * 8)) / 8);
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v = v + a & 255;
      else if (f === 2) v = v + b & 255;
      else if (f === 3) v = v + ((a + b) >> 1) & 255;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) & 255; }
      cur[x] = v;
    }
  }
  // to RGBA array
  const px = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let rgba;
    if (ctype === 6) { const i = y * stride + x * 4; rgba = [out[i], out[i + 1], out[i + 2], out[i + 3]]; }
    else if (ctype === 2) { const i = y * stride + x * 3; rgba = [out[i], out[i + 1], out[i + 2], 255]; }
    else if (ctype === 3) { const idx = out[y * stride + x]; const p = plte[idx] || [0, 0, 0]; rgba = [p[0], p[1], p[2], trns && trns[idx] !== undefined ? trns[idx] : 255]; }
    else { const i = y * stride + x; const g = out[i]; rgba = [g, g, g, 255]; }
    px.push(rgba);
  }
  return { w, h, px };
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

const { w, h, px } = decodePng(fs.readFileSync('assets-raw/kenney_tinydungeon/Tilemap/tilemap_packed.png'));
console.log(`tilemap ${w}x${h}px = ${Math.floor(w / 16)}x${Math.floor(h / 16)} tiles of 16px`);

// global color census (opaque pixels)
const census = new Map();
for (const p of px) { if (p[3] > 128) { const k = hex(p); census.set(k, (census.get(k) || 0) + 1); } }
const sorted = [...census].sort((a, b) => b[1] - a[1]);
console.log('distinct colors:', sorted.length);
console.log('top 30:');
sorted.slice(0, 30).forEach(([c, n]) => console.log(`  ${c}  ${n}`));

// per-tile census for the bottom rows (items/characters live there)
const TW = Math.floor(w / 16), TH = Math.floor(h / 16);
const tiles = [];
for (let ty = 0; ty < TH; ty++) {
  const row = [];
  for (let tx = 0; tx < TW; tx++) {
    const set = new Set();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const p = px[(ty * 16 + y) * w + tx * 16 + x];
      if (p[3] > 128) set.add(hex(p));
    }
    row.push(set);
  }
  tiles.push(row);
}
fs.writeFileSync('assets-raw/tile-colors.json', JSON.stringify(tiles.map(r => r.map(s => [...s]))));
console.log('per-tile colors -> assets-raw/tile-colors.json');
// print a compact index of tile opacity + dominant colors for human mapping
for (let ty = 0; ty < TH; ty++) {
  console.log('row ' + ty + ': ' + tiles[ty].map((s, i) => s.size > 0 ? `${i}(${s.size})` : '').join(' ').trim());
}
