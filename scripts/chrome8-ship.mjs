// Move the last two 8x8 marks — Update arrow and Warning — onto the 24x24 glyph grid,
// which retires 8x8 entirely. Both live in the Pixel-art gallery inside 132px tiles at
// 72px, and 72/24 = 3 exactly, so the display size does not change.
// Each keeps its own colour: mint for update, coral for warning.
import fs from 'node:fs';

const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');
const G = JSON.parse(fs.readFileSync('assets/glyphs.json', 'utf8'));

const MAP = {
  'Update arrow': { key: 'update', px: 72 },
  'Warning': { key: 'alert', px: 72 },
};

const re = /<svg\b[^>]*viewBox="0 0 8 8"[^>]*>[\s\S]*?<\/svg>/g;
const all = [...h.matchAll(re)];
console.log(`8x8 instances before: ${all.length}`);
if (all.length !== 2) throw new Error(`expected 2 remaining 8x8 marks, found ${all.length} — refusing to guess`);

const edits = [];
for (const m of all) {
  const label = (m[0].match(/aria-label="([^"]*)"/) || [, ''])[1];
  const t = MAP[label];
  if (!t) throw new Error(`unmapped 8x8 mark "${label}"`);
  if (!G[t.key]) throw new Error(`assets/glyphs.json has no "${t.key}"`);
  const fill = (m[0].match(/fill="([^"]+)"/) || [, 'currentColor'])[1];
  // keep the instance's own colour; swap only the geometry and the grid
  const inner = G[t.key].paths.replace(/fill="currentColor"/g, `fill="${fill}"`);
  const tag = `<svg width="${t.px}" height="${t.px}" viewBox="0 0 24 24" role="img" aria-label="${label}" shape-rendering="crispEdges" style="image-rendering:pixelated">${inner}</svg>`;
  edits.push({ at: m.index, len: m[0].length, text: tag, note: `${label} -> glyphs:${t.key} (fill ${fill})` });
}
for (const e of edits) console.log(`  ${e.note}`);
if (DRY) { console.log('--plan: nothing written'); process.exit(0); }

edits.sort((a, b) => b.at - a.at);
for (const e of edits) h = h.slice(0, e.at) + e.text + h.slice(e.at + e.len);

const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
const sv = (h.match(/<svg\b/g) || []).length, svc = (h.match(/<\/svg>/g) || []).length;
if (dv !== dvc) throw new Error(`div mismatch ${dv}/${dvc} — refusing to write`);
if (sv !== svc) throw new Error(`svg mismatch ${sv}/${svc} — refusing to write`);
const left = (h.match(/viewBox="0 0 8 8"/g) || []).length;
if (left) throw new Error(`${left} 8x8 instances survived — refusing to write`);
const g12 = (h.match(/viewBox="0 0 12 12"/g) || []).length;
if (g12) console.log(`note: ${g12} 12x12 still present`);

fs.writeFileSync(F, h);
console.log(`\nretired the 8x8 grid — 0 instances remain · div ${dv}/${dvc} · svg ${sv}/${svc}`);
