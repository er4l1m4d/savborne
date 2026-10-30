// Show the button/label context around each gallery-labelled glyph and its screen twins,
// so the shield/bag question is answered from real usage rather than inference.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');

// the gallery entries carry a <code>label</code>; grab their path signature and find twins
const sigOf = (el) => {
  const g = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (const p of el.matchAll(/d="([^"]*)"/g))
    for (const r of p[1].matchAll(/M(\d+) (\d+)h(\d+)/g))
      for (let i = 0; i < Number(r[3]); i++) g[Number(r[2])][Number(r[1]) + i] = 1;
  return g.map((r) => r.join('')).join('|');
};
const gallery = {};
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>\s*<code>([^<]+)<\/code>/g)) {
  gallery[sigOf(m[0])] = { name: m[1], at: m.index };
}
console.log('gallery-labelled glyphs:', Object.values(gallery).map((g) => g.name).join(', '), '\n');

for (const [sig, g] of Object.entries(gallery)) {
  if (!['shield', 'bag', 'leave'].includes(g.name)) continue;
  console.log(`=== "${g.name}" — every instance in the document ===`);
  let n = 0;
  for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>/g)) {
    if (sigOf(m[0]) !== sig) continue;
    n++;
    const after = h.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const text = after.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    const before = h.slice(Math.max(0, m.index - 400), m.index).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(-50);
    console.log(`  #${n}  …${before}  [ICON]  ${text}…`);
  }
  console.log('');
}
