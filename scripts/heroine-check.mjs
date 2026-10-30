// Verify the heroine composites against the recipe and the source pack, and render a
// hero-vs-heroine contact sheet. Reads the SHIPPED art (assets/characters.json paths),
// not the build's own data structures, so it validates the real artifact.
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

// Run-length rect encoding used by every batch script: M{x} {y}h{run}v1h-{run}z
const gridFromPaths = (s) => {
  const g = Array.from({ length: 16 }, () => Array(16).fill(null));
  for (const block of s.split(/(?=<path)/)) {
    const fill = block.match(/fill="([^"]+)"/);
    if (!fill) continue;
    for (const m of block.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      const [, xs, ys, rs] = m;
      for (let i = 0; i < Number(rs); i++) g[Number(ys)][Number(xs) + i] = fill[1];
    }
  }
  return g;
};

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const G = Object.fromEntries(Object.entries(ART).map(([k, p]) => [k, gridFromPaths(p)]));
const OUTLINE = '#3F2631', HAIR = '#BD6C4A';
const GOLD_MAP = { '#C0CBDC': '#FEE761', '#8B9BB4': '#FEAE34', '#52607C': '#BD6C4A', '#262B44': '#763B36' };
const rowStr = (g, y) => g[y].map((v) => v || '.').join('');
const eqRows = (a, b, from, to) => { for (let y = from; y <= to; y++) if (rowStr(a, y) !== rowStr(b, y)) return false; return true; };
const span = (row) => { const on = row.map((v, x) => (v ? x : -1)).filter((x) => x >= 0); return on.length ? [on[0], on[on.length - 1]] : null; };

const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); };

// 1. bodies are the gear tile's rows 10-15, untouched
for (const gear of ['Entry', 'Bronze']) {
  check(`Heroine ${gear}: body rows 10-15 identical to Hero ${gear}`,
    eqRows(G[`Hero · ${gear}`], G[`Heroine · ${gear}`], 10, 15));
}
// 2. heads are r8c3 rows 0-9 clipped to cols 2-13, nothing carried from below row 9
const src = tileGrid(8, 3);
for (const gear of ['Entry', 'Bronze']) {
  let ok = true;
  for (let y = 0; y <= 9; y++) for (let x = 0; x < 16; x++) {
    const want = y <= 9 && x >= 2 && x <= 13 ? src[y][x] : null;
    if (G[`Heroine · ${gear}`][y][x] !== want) ok = false;
  }
  check(`Heroine ${gear}: head is r8c3 rows 0-9 clipped to cols 2-13`, ok);
}
// 3. silhouette never wider than the hero's, row by row
for (const gear of ['Entry', 'Bronze', 'Silver', 'Gold']) {
  const h = G[`Hero · ${gear}`], f = G[`Heroine · ${gear}`];
  const bad = [];
  for (let y = 0; y < 16; y++) {
    const [hs, he] = span(h[y]) || [99, -99];
    const [fs, fe] = span(f[y]) || [99, -99];
    if (fs < hs || fe > he) bad.push(`row ${y}: heroine ${fs}..${fe} vs hero ${hs}..${he}`);
  }
  check(`Heroine ${gear}: silhouette within the hero's`, bad.length === 0, bad.join(' | '));
}
// 4. closed-helm gears: helm and body verbatim, only the four outline cells became hair
for (const gear of ['Silver', 'Gold']) {
  const h = G[`Hero · ${gear}`], f = G[`Heroine · ${gear}`];
  const diff = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (h[y][x] !== f[y][x]) diff.push([y, x, h[y][x], f[y][x]]);
  const wantCells = [[10, 5], [10, 6], [10, 9], [10, 10]];
  const cellsOk = diff.length === 4 && diff.every(([y, x], i) => y === wantCells[i][0] && x === wantCells[i][1]);
  const onlyOutlineToHair = diff.every(([, , from, to]) => from === OUTLINE && to === HAIR);
  check(`Heroine ${gear}: differs from the hero by exactly 4 hair pixels, outline cells only`, cellsOk && onlyOutlineToHair,
    diff.map(([y, x, a, b]) => `r${y}c${x} ${a}->${b}`).join(' '));
}
// 5. Gold heroine is the Silver heroine through the declared gilt map, nothing else
{
  const gilt = G['Heroine · Silver'].map((row) => row.map((v) => (v && GOLD_MAP[v] ? GOLD_MAP[v] : v)));
  let ok = true;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (gilt[y][x] !== G['Heroine · Gold'][y][x]) ok = false;
  check('Heroine Gold = Heroine Silver through the declared gilt map', ok);
}
// 6. eyes land where the hero's do
{
  const eyeRow = (g, y) => g[y].map((v, x) => (v === '#262B44' ? x : -1)).filter((x) => x >= 0);
  const he = eyeRow(G['Hero · Entry'], 7), fe = eyeRow(G['Heroine · Entry'], 7);
  check('Eyes at the same columns as the hero (6 and 10)', JSON.stringify(he) === '[6,10]' && JSON.stringify(fe) === '[6,10]',
    `hero ${he} heroine ${fe}`);
}
// 7. every key the app will ask for exists
{
  const want = ['Hero', 'Heroine'].flatMap((p) => ['Entry', 'Bronze', 'Silver', 'Gold'].map((g) => `${p} · ${g}`))
    .concat(['Rival · Mint Wraith', 'Rival · Hollow Ghost', 'Rival · Hooded Miser', 'Rival · Cutpurse']);
  const missing = want.filter((k) => !ART[k]);
  check(`All ${want.length} sprite keys present in characters.json`, missing.length === 0, missing.join(', '));
}

// ---- contact sheet: hero | heroine per gear, 8x ----
const S = 8, PAD = 14, KEYS = ['Hero · Entry', 'Heroine · Entry', 'Hero · Bronze', 'Heroine · Bronze', 'Hero · Silver', 'Heroine · Silver', 'Hero · Gold', 'Heroine · Gold'];
const W = PAD + KEYS.length * (16 * S + PAD), H = PAD + 16 * S + PAD;
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
KEYS.forEach((k, ti) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const col = G[k][y][x]; if (!col) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(PAD + ti * (16 * S + PAD) + x * S + dx, PAD + y * S + dy, rgbOf(col));
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
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/heroine-sheet.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));

let fail = 0;
for (const r of results) {
  if (!r.pass) fail++;
  console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  <- ' + r.detail : ''}`);
}
console.log(`\n${results.length} invariants — ${fail} FAIL, ${results.length - fail} ok`);
console.log('sheet: assets-raw/heroine-sheet.png');
process.exit(fail ? 1 : 0);
