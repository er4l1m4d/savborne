// What would spending the reserved `glow` channel actually look like?
//
// §4 reserves glow for nothing. The proposal is: glow = "an effect has been applied to
// this fighter", which gives defend and item-use a beat without stealing the lunge
// (aggression) or the coral tint (damage received). Defend and item look IDENTICAL by
// design — one meaning, one treatment; the turn log says which one happened.
//
// The hard part is colour. mint owns the HP bar, cream owns the plate and arena frames,
// coral owns damage. So three candidates, rendered, including one that adds no new hue.
import fs from 'node:fs';
import zlib from 'node:zlib';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const HERO = ART['Hero · Silver'];
const BG = '#0C1211', MINT = '#6FD0AE', EDGE = '#C9C1A8', PLATE = '#151F1D';
const N = 16;

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
function parse(art) {
  const g = Array.from({ length: N }, () => Array(N).fill(null));
  for (const p of art.matchAll(/fill="(#[0-9A-F]{6})"[^>]*d="([^"]*)"/g)) {
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g))
      for (let i = 0; i < Number(r[3]); i++) g[Number(r[2])][Number(r[1]) + i] = p[1];
  }
  return g;
}
// the silhouette rim: empty cells touching the sprite. 8-neighbour, not 4 — with 4 the
// diagonals leave gaps at every corner and the glow renders as a dotted outline.
function rim(g) {
  const out = Array.from({ length: N }, () => Array(N).fill(false));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      .some(([dx, dy]) => g[y + dy]?.[x + dx])) out[y][x] = true;
  }
  return out;
}
const grid = parse(HERO), ring = rim(grid);
const on = (g, x, y) => g[y][x] !== null;

const PW = 250, PH = 250, PAD = 18;
const VARIANTS = [
  { key: 'none', label: 'no glow — reference', desc: 'what the screen looks like today' },
  { key: 'gilt', label: 'gilt rim #FEE761', desc: 'bright, reads instantly. BUT #FEE761 is the earned-badge ramp colour' },
  { key: 'mint', label: 'mint rim #6FD0AE', desc: 'in-palette. BUT mint is the HP bar colour on the same plate' },
  { key: 'lift', label: 'value lift, no new hue', desc: 'sprite pixels pushed toward their own lightest colour. Adds no palette entry at all' },
];
const W = PAD + VARIANTS.length * (PW + PAD), H = PAD * 2 + PH;
const img = Buffer.alloc(W * H * 4);
function fill(x0, y0, w, h, hex) {
  const c = rgb(hex);
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y0 + h)); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x0 + w)); x++) {
      const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
    }
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function drawSprite(ox, oy, s, variant) {
  const lightest = [...new Set(grid.flat().filter(Boolean))].sort((a, b) => {
    const la = rgb(a).reduce((p, v) => p + v, 0), lb = rgb(b).reduce((p, v) => p + v, 0); return lb - la;
  })[0];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (on(grid, x, y)) {
      let col = grid[y][x];
      if (variant === 'lift') col = hexOf(mix(rgb(col), rgb(lightest), 0.55));
      fill(ox + x * s, oy + y * s, s, s, col);
    } else if (ring[y][x] && variant !== 'none' && variant !== 'lift') {
      const col = variant === 'gilt' ? '#FEE761' : '#6FD0AE';
      fill(ox + x * s, oy + y * s, s, s, col);
    }
  }
}
function panel(ox, oy, v, who) {
  fill(ox, oy, PW, PH, BG);
  fill(ox, oy, PW, 2, EDGE); fill(ox, oy + PH - 2, PW, 2, EDGE);
  fill(ox, oy, 2, PH, EDGE); fill(ox + PW - 2, oy, 2, PH, EDGE);
  const s = 12;
  const w = N * s, h = N * s;
  drawSprite(ox + (PW - w) / 2, oy + (PH - h) / 2 - 10, s, v.key);
  // a plate under it so the glow can be judged against the mint HP bar it must not fight
  const px = ox + 12, py = oy + PH - 54, pw = PW - 24;
  fill(px, py, pw, 40, EDGE); fill(px + 2, py + 2, pw - 4, 36, PLATE);
  fill(px + 10, py + 14, pw - 20, 12, EDGE); fill(px + 12, py + 16, pw - 24, 8, BG);
  fill(px + 12, py + 16, Math.round((pw - 24) * 0.78), 8, MINT);
  fill(ox + 12, oy + 10, 3, 22, '#FEE761');
  fill(ox + 18, oy + 10, Math.min(PW - 30, v.label.length * 7), 3, '#F3EEDD');
}
fill(0, 0, W, H, '#0E1614');
VARIANTS.forEach((v, i) => panel(PAD + i * (PW + PAD), PAD, v, 'hero'));

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/glow-candidates.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote assets-raw/glow-candidates.png  ${W}x${H}`);
console.log(`rim is ${ring.flat().filter(Boolean).length} px around a ${grid.flat().filter(Boolean).length} px sprite`);
VARIANTS.forEach((v, i) => console.log(`  panel ${i + 1}: ${v.label} — ${v.desc}`));
