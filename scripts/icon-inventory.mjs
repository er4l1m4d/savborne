// Inventory every icon/art slot in the handoff: what must be covered by the pack
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const slots = new Map(); // key: purpose -> {count, where}
function add(purpose, where) {
  const s = slots.get(purpose) || { count: 0, where: new Set() };
  s.count++; if (s.where.size < 3) s.where.add(where);
  slots.set(purpose, s);
}
const figs = c.split(/(?=<figure class="scr)/);
for (const f of figs) {
  const id = (f.match(/<figure class="scr" id="([^"]+)"/) || [])[1] || 'chrome';
  // nav tab icons (pixel 12x12 inside anchors)
  for (const m of f.matchAll(/<a href="(\/\w+)"[^>]*><svg width="(\d+)" height="\2"[^>]*viewBox="0 0 12 12"/g))
    add('nav:' + m[1].slice(1), id);
  // buttons with aria-label containing icon
  for (const m of f.matchAll(/aria-label="(Back|Leave|[^"]*icon[^"]*)"[^>]*>[\s\S]{0,220}?<svg/gi))
    add('btn:' + m[1].slice(0, 24), id);
  // role=img svgs (items/badges/sprites)
  for (const m of f.matchAll(/<svg width="(\d+)" height="\d+"[^>]*role="img" aria-label="([^"]{1,40})"/g))
    add('art:' + m[2].split(',')[0], id + '@' + m[1] + 'px');
  // sprite svgs
  for (const m of f.matchAll(/<svg class="spr"[^>]*viewBox="0 0 16 24"/g)) add('sprite 16x24', id);
  // pixel 12x12 icons not in nav (inline glyphs)
  for (const m of f.matchAll(/<svg width="\d+" height="\d+" viewBox="0 0 12 12"(?![\s\S]{0,80}role="img")/g)) add('glyph 12x12', id);
}
for (const [k, v] of [...slots].sort()) console.log(String(v.count).padStart(3) + '  ' + k + '   [' + [...v.where].join(', ') + ']');
