// The chosen treatment, with the sprite dimming alongside its plate — and the defeated
// state rendered next to it, because that is the only way to check they don't read as
// each other.
//
// The collision I first objected to is not reachable: battleServer.ts writes the HP clamp
// and status='completed' in the SAME update, so no fighter is ever at 0 HP while a turn is
// live. Opacity-for-waiting and opacity-for-defeated cannot co-occur.
//
// Value ordering is deliberate: waiting is alpha 0.62, defeated is 0.55 plus a shrink to
// 84. Nothing is ever dimmer than defeated, so the most extreme state on screen still means
// the most extreme thing.
//
// Alpha is blended against the real arena background so this PNG is faithful to what
// `opacity:` would produce in CSS, rather than a palette multiply that only looks similar.
import fs from 'node:fs';
import zlib from 'node:zlib';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const HERO = ART['Hero · Silver'], RIVAL = ART['Rival · Mint Wraith'];
const MINT = '#6FD0AE', EDGE = '#C9C1A8', PLATE = '#151F1D', BG = '#0C1211';

const AW = 318, AH = 300, PAD = 22, GAP = 30;
const W = PAD * 3 + AW * 2, H = PAD * 4 + AH * 2 + GAP;   // 2 rows of 2 panels
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
// true alpha over the arena background — what CSS `opacity` actually renders
function drawSprite(art, ox, oy, size, flip, alpha = 1) {
  const s = size / 16, bgc = rgb(BG);
  for (const p of art.matchAll(/fill="([^"]+)"[^>]*d="([^"]*)"/g)) {
    const c = rgb(p[1]);
    const out = alpha === 1 ? c : c.map((v, i) => Math.round(bgc[i] * (1 - alpha) + v * alpha));
    const hex = '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
      const x = Number(r[1]), y = Number(r[2]), w = Number(r[3]);
      for (let i = 0; i < w; i++) {
        const px = flip ? (15 - (x + i)) : (x + i);
        fill(ox + px * s, oy + y * s, Math.ceil(s), Math.ceil(s), hex);
      }
    }
  }
}
function plate(x, y, o) {
  const bw = 168, bh = 85, t = o.borderW;
  fill(x, y, bw, bh, o.border);
  fill(x + t, y + t, bw - 2 * t, bh - 2 * t, o.interior);
  fill(x + 12, y + 34, bw - 24, 14, o.border);
  fill(x + 14, y + 36, bw - 28, 10, BG);
  // HP bar keeps full colour on BOTH sides — dimming it measured 2.58:1 against its track
  fill(x + 14, y + 36, Math.round((bw - 28) * o.hp), 10, o.hpFill);
}
const ACT = { border: EDGE, borderW: 4, interior: PLATE, hp: 0.78, hpFill: MINT };
const IDLE = { border: dim(EDGE, 0.42), borderW: 2, interior: dim(PLATE, 0.55), hp: 0.78, hpFill: MINT };

function arena(ox, oy, mode) {
  fill(ox, oy, AW, AH, BG);
  fill(ox, oy, AW, 2, EDGE); fill(ox, oy + AH - 2, AW, 2, EDGE);
  fill(ox, oy, 2, AH, EDGE); fill(ox + AW - 2, oy, 2, AH, EDGE);
  if (mode === 'lost' || mode === 'won') {
    // reference: the defeated treatment from §4 — opacity 0.55 AND scale 84
    const heroLost = mode === 'lost';
    plate(ox + 14, oy + 14, heroLost ? { ...IDLE, hp: 0 } : ACT);
    plate(ox + 138, oy + AH - 121, heroLost ? ACT : { ...IDLE, hp: 0 });
    drawSprite(RIVAL, ox + 214, oy + 22, heroLost ? 84 : 108, true, heroLost ? 1 : 0.55);
    drawSprite(HERO, ox + (heroLost ? 38 : 28), oy + AH - 44 - (heroLost ? 84 : 108), heroLost ? 84 : 108, false, heroLost ? 0.55 : 1);
    return;
  }
  const heroTurn = mode === 'your';
  plate(ox + 14, oy + 14, heroTurn ? ACT : IDLE);
  plate(ox + 138, oy + AH - 121, heroTurn ? IDLE : ACT);
  // the sprite dims with its plate: alpha 0.62, brighter than defeated's 0.55
  drawSprite(RIVAL, ox + 214, oy + 22, 84, true, heroTurn ? 0.62 : 1);
  drawSprite(HERO, ox + 28, oy + AH - 44 - 104, 104, false, heroTurn ? 1 : 0.62);
}

fill(0, 0, W, H, '#0E1614');
arena(PAD, PAD, 'your');
arena(PAD * 2 + AW, PAD, 'their');
arena(PAD, PAD * 2 + AH + GAP, 'lost');
arena(PAD * 2 + AW, PAD * 2 + AH + GAP, 'won');

const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; img.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync('assets-raw/turn-signal-v3.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));

// how far apart are "waiting" and "defeated" actually? Sample the BRIGHTEST colour in the
// sprite — the first match was #3F2631, the outline, which is already near the background,
// so measuring the dim on it compared two blacks and proved nothing.
const lumOf = (c) => 0.2126 * c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))[0]
  + 0.7152 * c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))[1]
  + 0.0722 * c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))[2];
const ratioOf = (a, b) => { const [x, y] = [lumOf(a), lumOf(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const bgc = rgb(BG);
const heroCols = [...new Set([...HERO.matchAll(/fill="(#[0-9A-F]{6})"/g)].map((m) => m[1]))];
const heroMid = heroCols.sort((a, b) => lumOf(rgb(b)) - lumOf(rgb(a)))[0];
const hc = rgb(heroMid);
const wait = hc.map((v, i) => Math.round(bgc[i] * 0.38 + v * 0.62));
const dead = hc.map((v, i) => Math.round(bgc[i] * 0.45 + v * 0.55));
console.log('wrote assets-raw/turn-signal-v3.png');
console.log('top row  = your turn (left) and their turn (right), sprite dims with its plate at alpha 0.62');
console.log('bottom row = LOST (left) and WON (right), for comparison: defeated is alpha 0.55 AND scale 84');
console.log(`brightest hero colour ${heroMid} (lum ${lumOf(hc).toFixed(4)}), of ${heroCols.length} in the sprite`);
console.log(`  waiting  rgb(${wait.join(',')}) lum ${lumOf(wait).toFixed(4)}`);
console.log(`  defeated rgb(${dead.join(',')}) lum ${lumOf(dead).toFixed(4)}`);
console.log(`  waiting-vs-defeated ${ratioOf(wait, dead).toFixed(2)}:1 on luminance alone — and they never appear on the same screen`);
