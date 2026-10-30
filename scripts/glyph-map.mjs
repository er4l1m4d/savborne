// Identify every 12x12 UI glyph by USE (nearest text / button label), group identical
// shapes, and render the unique ones to a PNG so they can be looked at rather than described.
import fs from 'node:fs';
import zlib from 'node:zlib';

const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const owners = [...h.matchAll(/<(?:section|figure|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => (owners.filter((o) => o.at < idx).pop() || { id: '(none)' }).id;

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const groups = new Map();
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>/g)) {
  const el = m[0];
  const grid = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (const p of el.matchAll(/d="([^"]*)"/g)) {
    for (const r of p[1].matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      for (let i = 0; i < Number(r[3]); i++) grid[Number(r[2])][Number(r[1]) + i] = 1;
    }
  }
  const sig = grid.map((r) => r.join('')).join('|');
  // nearest following text is the button label; nearest preceding text catches icon-first labels
  const after = strip(h.slice(m.index + el.length, m.index + el.length + 220)).slice(0, 46);
  const before = strip(h.slice(Math.max(0, m.index - 220), m.index)).slice(-46);
  if (!groups.has(sig)) groups.set(sig, { grid, uses: [] });
  groups.get(sig).uses.push({ owner: ownerAt(m.index), after, before, color: (el.match(/fill="([^"]*)"/) || [, ''])[1] });
}

const list = [...groups.entries()];
console.log(`${list.reduce((n, g) => n + g[1].uses.length, 0)} glyph instances in ${list.length} unique shapes\n`);
list.forEach(([, g], i) => {
  const where = [...new Set(g.uses.map((u) => u.owner))].join(', ');
  const texts = [...new Set(g.uses.map((u) => (u.after || u.before).split(/[·|]/)[0].trim().slice(0, 30)))];
  console.log(`#${i}  x${g.uses.length}  in [${where}]`);
  console.log(`     reads as: ${texts.join(' // ')}`);
});

// ---- PNG sheet, 14x scale, ink on the app ground ----
const S = 14, PAD = 18, COLS = Math.min(6, list.length);
const ROWS = Math.ceil(list.length / COLS);
const CELL = 12 * S;
const W = PAD + COLS * (CELL + PAD), H = PAD + ROWS * (CELL + PAD + 16);
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
list.forEach(([, g], i) => {
  const cx = PAD + (i % COLS) * (CELL + PAD), cy = PAD + Math.floor(i / COLS) * (CELL + PAD + 16);
  // guides first, ink second — ink must not be overwritten by the grid
  for (let k = 0; k <= 12; k++) { for (let t = 0; t < CELL; t++) { put(cx + t, cy + k * S, [46, 70, 66]); put(cx + k * S, cy + t, [46, 70, 66]); } }
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    if (!g.grid[y][x]) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(cx + x * S + dx, cy + y * S + dy, [243, 238, 221]);
  }
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/glyph-sheet.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('\nsheet: assets-raw/glyph-sheet.png (row-major, #0 top-left, grid guides at 1px)');
