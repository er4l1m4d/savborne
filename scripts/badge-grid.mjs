// Stream 5, first question: what GRID do badges belong on?
// Answered by building the same badge — roundel + ribbon, per bible rule 4 — at 8, 12 and 16,
// in all three states, and putting every one through the real gate. The drawing is not the
// variable; the grid is.
//
// States are treatments on one drawing, not three drawings:
//   earned  = gilt ramp      locked = steel ramp      removed = slate ramp
// Each ramp is chosen so at least one of its colours clears the 3:1 visibility bar.
import fs from 'node:fs';
import zlib from 'node:zlib';

const OUT = '#3F2631';
const RAMPS = {
  earned:  { metal: '#FEE761', mid: '#FEAE34', deep: '#BD6C4A', ribbon: '#E84537' },
  locked:  { metal: '#C0CBDC', mid: '#8B9BB4', deep: '#52607C', ribbon: '#5A6988' },
  removed: { metal: '#8B9BB4', mid: '#5A6988', deep: '#52607C', ribbon: '#763B36' },
};

// disc mask: a pixel circle filling the tile with 1px of breathing room, ribbon below it
function badge(N) {
  const cx = (N - 1) / 2, cy = (N - 1) / 2 - (N >= 12 ? 1 : 0);
  const r = N / 2 - (N >= 12 ? 1.2 : 0.6);
  const g = Array.from({ length: N }, () => Array(N).fill(null));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= r) g[y][x] = 'body';
    else if (d <= r + 1.05) g[y][x] = 'edge';
  }
  // ribbon: a band across the lower third, only if there is room for one that is not the whole tile
  const bandH = N >= 16 ? 3 : N >= 12 ? 2 : 1;
  const bandTop = N - bandH - 1;
  if (bandTop > cy) for (let y = bandTop; y < bandTop + bandH; y++) for (let x = 0; x < N; x++) {
    if (Math.abs(x - cx) <= r * 0.95) g[y][x] = 'ribbon';
  }
  // inner mark: a 45deg blade, tip up-right. Needs a clear interior of >= 5px to exist at all
  const interior = Math.floor(r * 1.2);
  if (interior >= 5) {
    for (let i = 0; i < interior - 1; i++) {
      const x = Math.round(cx - interior / 2 + i), y = Math.round(cy + interior / 2 - i);
      if (g[y]?.[x] === 'body') g[y][x] = 'mark';
    }
  }
  // light source top-left: the upper-left of the ring is the bright metal, lower-right is deep
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] !== 'body') continue;
    const up = (x - cx) + (y - cy) < 0;
    g[y][x] = g[y][x] === 'mark' ? 'mark' : up ? 'metal' : 'deep';
  }
  return g;
}

function paths(g, ramp) {
  const N = g.length, byColor = new Map();
  const col = (v) => v === 'edge' ? OUT : v === 'ribbon' ? ramp.ribbon : v === 'mark' ? ramp.mid
    : v === 'metal' ? ramp.metal : v === 'deep' ? ramp.deep : v === 'body' ? ramp.mid : null;
  for (let y = 0; y < N; y++) for (let x = 0; x < N;) {
    const c = col(g[y][x]);
    if (!c) { x++; continue; }
    let run = 1; while (x + run < N && col(g[y][x + run]) === c) run++;
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return [...byColor].map(([c, ds]) => `<path fill="${c}" shape-rendering="crispEdges" d="${ds.join('')}"></path>`).join('');
}
function orphans(g) {
  const N = g.length; let n = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!g[y][x]) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx])) n++;
  }
  return n;
}

const SIZES = [8, 12, 16];
const STATES = ['earned', 'locked', 'removed'];
const built = {};
console.log('grid  state    painted  colours  orphans  inner mark?');
for (const N of SIZES) {
  const g = badge(N);
  const mark = g.flat().includes('mark');
  for (const st of STATES) {
    const p = paths(g, RAMPS[st]);
    built[`${N}-${st}`] = p;
    console.log(`${String(N).padStart(3)}   ${st.padEnd(8)} ${String(g.flat().filter(Boolean).length).padStart(5)}  ${new Set(p.match(/fill="[^"]+"/g) || []).size}        ${String(orphans(g)).padStart(2)}       ${mark ? 'yes' : '*** NO ROOM ***'}`);
  }
}
fs.writeFileSync('assets-raw/badges-grid-temp.html', `<html><body>${
  Object.entries(built).map(([k, p]) => `<svg width="${k.startsWith('8') ? 32 : 48}" height="${k.startsWith('8') ? 32 : 48}" viewBox="0 0 ${k.split('-')[0]} ${k.split('-')[0]}" role="img" aria-label="First Blade badge, ${k.split('-')[1]} at ${k.split('-')[0]}">${p}</svg>`).join('\n')
}</body></html>`);

// PNG sheet at 8x so all nine are comparable at the same on-screen size
const S = 8, PAD = 14, COLS = 3;
const W = PAD + COLS * (16 * S + PAD + 40), H = PAD + SIZES.length * (16 * S + PAD);
const img = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 12; img[i * 4 + 1] = 18; img[i * 4 + 2] = 17; img[i * 4 + 3] = 255; }
const put = (x, y, c) => { const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; };
SIZES.forEach((N, row) => STATES.forEach((st, col) => {
  const g = badge(N), ramp = RAMPS[st];
  const cx0 = PAD + col * (16 * S + PAD + 40) + 40, cy0 = PAD + row * (16 * S + PAD);
  const paint = (v) => v === 'edge' ? OUT : v === 'ribbon' ? ramp.ribbon : v === 'mark' ? ramp.mid
    : v === 'metal' ? ramp.metal : v === 'deep' ? ramp.deep : v === 'body' ? ramp.mid : null;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = paint(g[y][x]); if (!c) continue;
    const rgb = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(cx0 + x * S + dx, cy0 + y * S + dy, rgb);
  }
}));
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/badges-grid.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('\nsheet: assets-raw/badges-grid.png — rows are grids 8/12/16, columns are earned/locked/removed');
console.log('gate temp: assets-raw/badges-grid-temp.html');
