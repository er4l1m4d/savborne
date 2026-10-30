// Rasterises the blink test so it can be answered from an image, not a live tab.
//
// Deliberately renders NO TEXT. The question is whether the visual channels alone say
// whose turn it is — so a render containing the words "YOUR MOVE" would answer a
// different question. Plates are shapes and borders only.
//
// 2x2: rows = whose turn, columns = full treatment vs border-only (the reduced-motion
// case, where the bob does not exist at all). Plus a zoomed detail of the bob's travel.
import fs from 'node:fs';
import zlib from 'node:zlib';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const HERO = ART['Hero · Silver'], RIVAL = ART['Rival · Mint Wraith'];
const MINT = '#6FD0AE', EDGE = '#C9C1A8', PLATE = '#151F1D', BG = '#0C1211', HPBG = '#0C1211';

const AW = 318, AH = 300, GAP = 26, PAD = 22;
const W = PAD * 3 + AW * 2, H = PAD * 3 + AH * 2 + 120;
const img = Buffer.alloc(W * H * 4);
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
function fill(x0, y0, w, h, hex) {
  const c = rgb(hex);
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
    }
}
function blend(x0, y0, w, h, hex, a) {
  const c = rgb(hex);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = (y * W + x) * 4;
    img[i] = img[i] * (1 - a) + c[0] * a; img[i + 1] = img[i + 1] * (1 - a) + c[1] * a; img[i + 2] = img[i + 2] * (1 - a) + c[2] * a;
  }
}
// parse the run-length rect encoding used in characters.json
function drawSprite(art, ox, oy, size, flip, ghost = false) {
  const s = size / 16;
  for (const p of art.matchAll(/fill="([^"]+)"[^>]*d="([^"]*)"/g)) {
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
      const x = Number(r[1]), y = Number(r[2]), w = Number(r[3]);
      for (let i = 0; i < w; i++) {
        const px = flip ? (15 - (x + i)) : (x + i);
        if (ghost) blend(Math.round(ox + px * s), Math.round(oy + y * s), Math.ceil(s), Math.ceil(s), p[1], 0.35);
        else fill(Math.round(ox + px * s), Math.round(oy + y * s), Math.ceil(s), Math.ceil(s), p[1]);
      }
    }
  }
}
function plate(x, y, lit, hp) {
  const bw = 168, bh = 85, col = lit ? MINT : EDGE;
  fill(x, y, bw, bh, col);                       // border
  fill(x + 2, y + 2, bw - 4, bh - 4, PLATE);     // interior
  fill(x + 12, y + 34, bw - 24, 14, EDGE);       // hp bar frame
  fill(x + 14, y + 36, bw - 28, 10, HPBG);
  fill(x + 14, y + 36, Math.round((bw - 28) * hp / 100), 10, hp > 50 ? MINT : hp > 20 ? '#F2B544' : '#F2735A');
}
function arena(ox, oy, { heroTurn, borderOnly }) {
  fill(ox, oy, AW, AH, BG);
  fill(ox, oy, AW, 2, EDGE); fill(ox, oy + AH - 2, AW, 2, EDGE);
  fill(ox, oy, 2, AH, EDGE); fill(ox + AW - 2, oy, 2, AH, EDGE);
  plate(ox + 14, oy + 14, heroTurn, 78);                 // hero plate, top-left
  plate(ox + 138, oy + AH - 121, !heroTurn, 62);         // rival plate, bottom-right
  const bob = borderOnly ? 0 : -2;                       // reduced-motion: no travel at all
  const heroY = oy + AH - 44 - 104 + (heroTurn ? bob : 0);
  const rivalY = oy + 22 + (!heroTurn ? bob : 0);
  drawSprite(RIVAL, ox + 214, rivalY, 84, true);
  drawSprite(HERO, ox + 28, heroY, 104, false);
  // the acting sprite gets a 2px travel indicator when motion is on
  if (!borderOnly) {
    const y = heroTurn ? heroY : rivalY;
    const x = heroTurn ? ox + 28 : ox + 214;
    const w = heroTurn ? 104 : 84;
    blend(x, y + 2, w, 2, '#FFFFFF', 0.5);
  }
}

fill(0, 0, W, H, '#0E1614');
arena(PAD, PAD, { heroTurn: true, borderOnly: false });
arena(PAD * 2 + AW, PAD, { heroTurn: true, borderOnly: true });
arena(PAD, PAD * 2 + AH, { heroTurn: false, borderOnly: false });
arena(PAD * 2 + AW, PAD * 2 + AH, { heroTurn: false, borderOnly: true });

// zoomed detail: the bob's actual travel, 2px on a 104px sprite
const dy = PAD * 3 + AH * 2;
fill(PAD, dy, 220, 100, BG);
for (let f = 0; f < 2; f++) drawSprite(HERO, PAD + 10 + f * 100, dy + 10 + f * 2, 76, false);
fill(PAD + 8, dy + 8, 2, 84, '#FFFFFF');
fill(PAD + 108, dy + 10, 2, 84, '#FFFFFF');
// ruler ticks every 2px along the right of the detail
for (let t = 0; t < 10; t++) fill(PAD + 200, dy + 12 + t * 9, 6, 1, '#4B5A56');

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/blink-test.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote assets-raw/blink-test.png  ${W}x${H}`);
console.log('row 1 = YOUR turn · row 2 = THEIR turn · left col = with motion · right col = border only (reduced-motion)');
