// Palette integrity check: enumerate every colour actually present in tilemap_packed.png
// and diff it against the 27 the bible declares and the list art-gates.mjs allows.
// A floor tile just reported #FEC99C, which is not in either list — if the census is
// wrong, the bible's palette section and the gate are both incomplete.
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

// count actual OPAQUE pixel usage per colour — that is what "the palette" should mean
const used = new Map();
for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
  let rgba;
  if (P.ctype === 6) { const i = y * P.stride + x * 4; rgba = [P.out[i], P.out[i + 1], P.out[i + 2], P.out[i + 3]]; }
  else { const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0]; rgba = [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255]; }
  if (rgba[3] < 128) continue;
  const hex = hexOf(rgba);
  used.set(hex, (used.get(hex) || 0) + 1);
}
const census = [...used].sort((a, b) => b[1] - a[1]);
const doc = fs.readFileSync('docs/art-bible.md', 'utf8').replace(/\r\n/g, '\n');
// stop before the round-2 finding paragraph — it names NON-pack colours on purpose
const bibleEnd = Math.min(doc.indexOf('**Round-2 audit finding', doc.indexOf('## 2. The palette')), doc.indexOf('## 2b'));
const bible = doc.slice(doc.indexOf('## 2. The palette'), bibleEnd);
const declared = new Set((bible.match(/#[0-9A-F]{6}/g) || []));
const gate = new Set(/const PACK = \[([^\]]+)\]/.exec(fs.readFileSync('scripts/art-gates.mjs', 'utf8'))[1].match(/#[0-9A-F]{6}/g));

console.log(`PLTE entries: ${P.plte.length}   distinct OPAQUE colours actually used: ${census.length}`);
console.log(`bible declares: ${declared.size}   gate allows: ${gate.size}\n`);
const notInBible = census.filter(([h]) => !declared.has(h));
const notInGate = census.filter(([h]) => !gate.has(h));
const declaredButUnused = [...declared].filter((h) => !used.has(h));
console.log(`in the sheet but NOT in the bible: ${notInBible.length ? notInBible.map(([h, n]) => `${h}(x${n})`).join(' ') : 'none'}`);
console.log(`in the sheet but NOT in the gate : ${notInGate.length ? notInGate.map(([h, n]) => `${h}(x${n})`).join(' ') : 'none'}`);
console.log(`declared by the bible but never used in the sheet: ${declaredButUnused.length ? declaredButUnused.join(' ') : 'none'}`);
console.log('\nfull census (colour x opaque-pixel count):');
console.log(census.map(([h, n]) => `${h} ${n}`).join('\n'));
