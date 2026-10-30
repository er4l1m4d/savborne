// CURRENT vs PROPOSED, rendered, no text, so the comparison is a picture not a paragraph.
//
// Why the current one fails: the acting plate's mint border against the neutral cream
// border is 1.03:1 — a hue difference on a 2px line, invisible in grayscale, and the
// plate's own HP bar is the same mint in a shape 70x louder.
//
// Proposed: luminance does the work. The ACTING plate is at full brightness with a 4px
// border; the non-acting plate dims to 4.41:1 on its border and its interior and HP bar
// drop with it. Two channels agree (brightness + border weight) and neither is colour, so
// it survives grayscale, colourblindness AND prefers-reduced-motion — which the bob does not.
import fs from 'node:fs';
import zlib from 'node:zlib';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const HERO = ART['Hero · Silver'], RIVAL = ART['Rival · Mint Wraith'];
const MINT = '#6FD0AE', EDGE = '#C9C1A8', PLATE = '#151F1D', BG = '#0C1211', AMBER = '#F2B544', CORAL = '#F2735A';

const AW = 318, AH = 300, PAD = 22, ROWGAP = 34;
const W = PAD * 3 + AW * 2, H = PAD * 3 + AH * 2 + ROWGAP;
const img = Buffer.alloc(W * H * 4);
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const dim = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
function fill(x0, y0, w, h, hex) {
  const c = rgb(hex);
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y0 + h)); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x0 + w)); x++) {
      const i = (y * W + x) * 4; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
    }
}
function drawSprite(art, ox, oy, size, flip, f = 1) {
  const s = size / 16;
  for (const p of art.matchAll(/fill="([^"]+)"[^>]*d="([^"]*)"/g)) {
    const col = f === 1 ? p[1] : dim(p[1], f);
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
      const x = Number(r[1]), y = Number(r[2]), w = Number(r[3]);
      for (let i = 0; i < w; i++) {
        const px = flip ? (15 - (x + i)) : (x + i);
        fill(ox + px * s, oy + y * s, Math.ceil(s), Math.ceil(s), col);
      }
    }
  }
}
function plate(x, y, { border, borderW, interior, hpFill, hpTrack }) {
  const bw = 168, bh = 85, t = borderW;
  fill(x, y, bw, bh, border);
  fill(x + t, y + t, bw - 2 * t, bh - 2 * t, interior);
  fill(x + 12, y + 34, bw - 24, 14, border);
  fill(x + 14, y + 36, bw - 28, 10, hpTrack);
  fill(x + 14, y + 36, Math.round((bw - 28) * 0.78), 10, hpFill);
}
function arena(ox, oy, heroTurn, proposed) {
  fill(ox, oy, AW, AH, BG);
  fill(ox, oy, AW, 2, EDGE); fill(ox, oy + AH - 2, AW, 2, EDGE);
  fill(ox, oy, 2, AH, EDGE); fill(ox + AW - 2, oy, 2, AH, EDGE);
  const act = { border: proposed ? EDGE : MINT, borderW: proposed ? 4 : 2, interior: PLATE, hpFill: MINT, hpTrack: BG };
  // Frame dims, HP bar does NOT. Dimming the bar to dim(MINT,0.45)=#315E4E measured 2.58:1
  // against its own track — under the 3:1 non-text bar, the same defect that failed the old
  // badges. The border and interior carry the state; the bar stays readable on both sides.
  const idle = proposed
    ? { border: dim(EDGE, 0.42), borderW: 2, interior: dim(PLATE, 0.55), hpFill: MINT, hpTrack: dim(BG, 1) }
    : { border: EDGE, borderW: 2, interior: PLATE, hpFill: MINT, hpTrack: BG };
  plate(ox + 14, oy + 14, heroTurn ? act : idle);
  plate(ox + 138, oy + AH - 121, heroTurn ? idle : act);
  // SPRITES NEVER DIM. §4 assigns opacity to the defeated state at 0.55, and a
  // "waiting" dim at 0.62 would sit two hundredths away from "knocked out" — the same
  // channel-collision class this bible has been chasing all session. Only the PLATE dims;
  // the plate owns no opacity value today, so the channel is free there.
  drawSprite(RIVAL, ox + 214, oy + 22, 84, true, 1);
  drawSprite(HERO, ox + 28, oy + AH - 44 - 104, 104, false, 1);
}

fill(0, 0, W, H, '#0E1614');
arena(PAD, PAD, true, false);
arena(PAD * 2 + AW, PAD, false, false);
arena(PAD, PAD * 2 + AH + ROWGAP, true, true);
arena(PAD * 2 + AW, PAD * 2 + AH + ROWGAP, false, true);

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/turn-signal-v2.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote assets-raw/turn-signal-v2.png');
console.log('TOP ROW  = current §4 treatment (mint border on the acting plate, 1.03:1 vs neutral)');
console.log('BOTTOM ROW = proposed (acting plate full brightness + 4px border, non-acting dims to 4.41:1)');
console.log('left column = your turn · right column = their turn. No text anywhere, on purpose.');
