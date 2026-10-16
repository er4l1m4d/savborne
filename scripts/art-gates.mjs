// Art gates: palette audit + orphan check + silhouette dump for every art SVG in the handoff
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');

// Allowed = pack 27 (docs/art-bible.md §2) + UI tokens (chrome exception)
const PACK = ['#3F2631', '#262B44', '#52607C', '#8B9BB4', '#C0CBDC', '#FFFFFF', '#763B36', '#BD6C4A', '#CF8254', '#EAA56C', '#F7C282', '#E19A65', '#69FFD4', '#43E1B3', '#25956A', '#FF706D', '#E84537', '#FEAE34', '#FEE761', '#75E3FF', '#0099DB', '#D176D0', '#9B4CA3', '#AAB7CC', '#E4EDF9'];
const TOKENS = ['#0C1211', '#151F1D', '#101A18', '#243532', '#C9C1A8', '#2E4642', '#F3EEDD', '#A9B8B2', '#6FD0AE', '#F2735A', '#A8452F', '#FF9C86', '#2A1B18', '#4B5A56', '#0C3B35', '#F6EFD9', '#FF6A4D', 'currentColor'];
const ALLOWED = new Set([...PACK, ...TOKENS]);

const GRID = /^<svg [^>]*viewBox="0 0 (12|16) (12|16|24)"/;
const assets = [];
for (const m of c.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
  const tag = m[0];
  if (!GRID.test(tag)) continue;
  const W = +tag.match(/viewBox="0 0 (\d+)/)[1], H = +tag.match(/viewBox="0 0 \d+ (\d+)/)[1];
  const g = Array.from({ length: H }, () => Array(W).fill(null));
  const bad = new Set();
  for (const p of tag.matchAll(/<path([^>]*)d="([^"]*)"><\/path>/g)) {
    const fill = (p[1].match(/fill="([^"]+)"/) || [])[1];
    if (!fill) continue;
    if (!ALLOWED.has(fill.toUpperCase() === fill ? fill : fill)) {
      if (!ALLOWED.has(fill)) bad.add(fill);
    }
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
      const [, x, y, w] = r.map(Number);
      for (let i = 0; i < w; i++) if (g[y] && g[y][x + i] !== undefined) g[y][x + i] = fill;
    }
  }
  const label = (tag.match(/aria-label="([^"]*)"/) || [])[1] || guessContext(m.index, c);
  assets.push({ label, W, H, g, bad: [...bad] });
}
function guessContext(idx, src) {
  const before = src.slice(Math.max(0, idx - 400), idx);
  const id = (before.match(/id="(A_[A-Za-z]+)"/g) || []).pop();
  return (id || 'section-art').replace(/id="|"/g, '') + ':icon';
}
const lum = (hex) => {
  if (hex === 'currentColor') return 0.55;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// --- Step 2: contrast gate (art colors vs actual UI backgrounds) ---
const BG = { ground: '#0C1211', surface: '#151F1D' };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const lift = (hex, bg, target = 3.0) => {
  if (ratio(hex, bg) >= target) return null;
  const n = parseInt(hex.slice(1), 16); let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let step = 1; step <= 100; step++) {
    const t = step / 100;
    const c = '#' + [r, g, b].map(v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
    if (ratio(c, bg) >= target) return c;
  }
  return '#FFFFFF';
};
const colorAudit = PACK.map((col) => ({
  col, vsGround: +ratio(col, BG.ground).toFixed(2), vsSurface: +ratio(col, BG.surface).toFixed(2),
})).map((e) => ({ ...e, fails: e.vsGround < 3 && e.vsSurface < 3, lift: e.vsGround < 3 ? lift(e.col, BG.ground) : null }));
let fails = 0;
const lines = [];
for (const a of assets) {
  const issues = [];
  if (a.bad.length) issues.push('PALETTE: ' + a.bad.join(' '));
  let orphans = 0;
  for (let y = 0; y < a.H; y++) for (let x = 0; x < a.W; x++) {
    if (!a.g[y][x]) continue;
    const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nx, ny]) => a.g[ny] && a.g[ny][nx]).length;
    if (!n) orphans++;
  }
  if (orphans) issues.push(`ORPHANS: ${orphans}`);
  // asset-level visibility: at least one painted color must reach 3:1 vs ground (WCAG 1.4.11)
  const used = new Set();
  for (const row of a.g) for (const v of row) if (v) used.add(v);
  const vis = Math.max(...[...used].map((u) => ratio(u === 'currentColor' ? '#A9B8B2' : u, BG.ground)));
  if (vis < 3) issues.push(`VISIBILITY: best color only ${vis.toFixed(2)}:1 vs ground`);
  if (issues.length) fails++;
  const sil = a.g.map((row) => row.map((v) => (v ? (lum(v) > 0.45 ? '@' : '#') : '.')).join('')).join('\n');
  lines.push(`${issues.length ? 'FAIL' : 'pass'}  ${a.label} (${a.W}x${a.H})  ${issues.join(' | ')}`);
  if (process.env.SHOW_SIL) lines.push(sil);
}
console.log(lines.join('\n'));
console.log(`\n${assets.length} art assets audited — ${fails} FAIL, ${assets.length - fails} pass`);
console.log('grayscale legend: @ = light (L>0.45), # = dark, . = transparent');
console.log('\n--- PACK COLOR CONTRAST AUDIT vs UI backgrounds (≥3:1 required to carry an icon alone) ---');
for (const e of colorAudit) {
  const flag = e.fails ? (e.lift ? `LOW  → brightened variant ${e.lift}` : 'LOW') : 'ok  ';
  console.log(`${flag}  ${e.col}  ground ${String(e.vsGround).padStart(5)}:1   surface ${String(e.vsSurface).padStart(5)}:1`);
}
