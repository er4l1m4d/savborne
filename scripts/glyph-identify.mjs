// Identify the unlabelled 12x12 glyphs by their real context: enclosing button/div text,
// the screen they sit on, and what is painted around them. Emits a labelled shape sheet too.
import fs from 'node:fs';
import zlib from 'node:zlib';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');

const owners = [...h.matchAll(/<(?:section|figure|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => (owners.filter((o) => o.at < idx).pop() || { id: '(none)' }).id;
const strip = (s) => s.replace(/<svg\b[\s\S]*?<\/svg>/g, ' [icon] ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// the nearest enclosing <button> / <div> whose text is non-trivial
function enclosing(idx) {
  const bo = h.lastIndexOf('<button', idx), bc = h.lastIndexOf('</button>', idx);
  if (bo > bc) return { tag: 'button', text: strip(h.slice(bo, h.indexOf('</button>', idx) + 9)) };
  const do0 = h.lastIndexOf('<div', idx), dc = h.lastIndexOf('</div>', idx);
  if (do0 > dc) return { tag: 'div', text: strip(h.slice(do0, Math.min(h.length, idx + 300))).slice(0, 120) };
  return { tag: '(none)', text: '' };
}

const shapes = new Map();
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>/g)) {
  const el = m[0];
  const grid = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (const p of el.matchAll(/d="([^"]*)"/g))
    for (const r of p[1].matchAll(/M(\d+) (\d+)h(\d+)/g))
      for (let i = 0; i < Number(r[3]); i++) grid[Number(r[2])][Number(r[1]) + i] = 1;
  const sig = grid.map((r) => r.join('')).join('|');
  const after = h.slice(m.index + el.length, m.index + el.length + 60);
  const label = (/^\s*<code>([^<]+)<\/code>/.exec(after) || [, ''])[1];
  if (!shapes.has(sig)) shapes.set(sig, { grid, gallery: label, uses: [] });
  const g = shapes.get(sig);
  if (label) g.gallery = label;
  const en = enclosing(m.index);
  const near = strip(h.slice(Math.max(0, m.index - 300), m.index + 220));
  g.uses.push({ owner: ownerAt(m.index), tag: en.tag, text: en.text.slice(0, 110), near });
}

const list = [...shapes.values()];
console.log(`${list.length} unique 12x12 shapes\n`);
list.forEach((s, i) => {
  console.log(`### #${i}${s.gallery ? `  GALLERY LABEL: "${s.gallery}"` : '   *** UNLABELLED ***'}   (${s.uses.length} instance${s.uses.length > 1 ? 's' : ''})`);
  for (const u of s.uses) {
    console.log(`      [${u.owner}] in <${u.tag}> "${u.text}"`);
    if (!s.gallery) console.log(`         nearby: …${u.near.slice(0, 190)}…`);
  }
  console.log('');
});

// labelled sheet, row-major, 4 per row, index order matches the report above
const S = 11, PAD = 16, COLS = 4, CELL = 12 * S;
const ROWS = Math.ceil(list.length / COLS);
const W = PAD + COLS * (CELL + PAD), H = PAD + ROWS * (CELL + PAD);
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
list.forEach((s, i) => {
  const cx = PAD + (i % COLS) * (CELL + PAD), cy = PAD + Math.floor(i / COLS) * (CELL + PAD);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    if (!s.grid[y][x]) continue;
    for (let dy = 0; dy < S - 1; dy++) for (let dx = 0; dx < S - 1; dx++) put(cx + x * S + dx, cy + y * S + dy, [243, 238, 221]);
  }
});
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/glyph-identify.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('sheet: assets-raw/glyph-identify.png — row-major, #0 top-left, 4 per row');
