// Inventory the 12x12 UI glyphs in the handoff: label, where it is used, its colours, and
// a plain-ASCII render of the grid so the drawn shape can be read without a screenshot.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const owners = [...h.matchAll(/<(?:section|figure|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => (owners.filter((o) => o.at < idx).pop() || { id: '(none)' }).id;

const els = [...h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>/g)];
console.log(`${els.length} 12x12 svgs\n`);
const seen = new Map();
for (const m of els) {
  const el = m[0];
  const label = (el.match(/aria-label="([^"]*)"/) || [, ''])[1];
  const grid = Array.from({ length: 12 }, () => Array(12).fill('.'));
  const colors = new Set();
  for (const p of el.matchAll(/fill="([^"]+)"[^>]*d="([^"]*)"/g)) {
    colors.add(p[1]);
    const ch = 'abcdefgh'[[...colors].indexOf(p[1])] ?? '?';
    for (const r of p[2].matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      for (let i = 0; i < Number(r[3]); i++) grid[Number(r[2])][Number(r[1]) + i] = ch;
    }
  }
  const sig = grid.map((r) => r.join('')).join('');
  const dup = seen.get(sig);
  if (!dup) seen.set(sig, { label, owner: ownerAt(m.index), colors: [...colors] });
  console.log(`[${ownerAt(m.index)}] "${label}"  colours: ${[...colors].join(' ')}${dup ? '   (same art as "' + dup.label + '")' : ''}`);
  if (!dup) grid.forEach((r, y) => console.log('   ' + r.join('').replace(/\./g, '·')));
}
console.log(`\nunique glyph shapes: ${seen.size}`);
