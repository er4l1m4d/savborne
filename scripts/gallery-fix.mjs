// Rebuild the Pixel-art section's Item-art gallery to match the Icon-set presentation, fix stale intro
import fs from 'node:fs';
let h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const items = JSON.parse(fs.readFileSync('assets/items.json', 'utf8'));

// 1. stale section intro (claims 12x12 items, 16x24 chars, round-2 palette)
const oldIntro = h.slice(h.indexOf('<h2 id="art">'), h.indexOf('<h3>Icon set</h3>'));
h = h.replace(oldIntro,
`<h2 id="art">Pixel art</h2>
<p>All art is final and governed by <code>docs/art-bible.md</code>. Grids: nav icons <b>16×16</b> Tiny Dungeon tiles snapped to product hues, UI glyphs <b>12×12</b> hand-drawn duotone, characters <b>16×16</b> pack-native tiles, items <b>16×16</b> (pack tiles + programmatic builds). Whole-pixel scales only (2×–8×), <code>shape-rendering: crispEdges</code>, no rotation. Art palette is Kenney's own 27-color set (bible §2) — the four structural darks are interior-outline/shadow only; every asset carries ≥1 color at 3:1 vs the app ground.</p>
`);

// 2. rebuild Item art subsection (same card structure as the icon set)
const names = ['Cloth Purse', 'Ledger Tome', 'Bronze Shield', 'Copper Compass', 'Silver Blade', 'Silver Charm', 'Gold Gauntlet', 'Golden Crown'];
const cards = names.map((n) =>
  `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px"><svg width="48" height="48" viewBox="0 0 16 16" style="image-rendering:pixelated">${items[n]}</svg><code>${n}</code></div>`).join('');
const start = h.indexOf('<h3>Item art</h3>');
const end = h.indexOf('<h2 id="components">');
h = h.slice(0, start) +
`<h3>Item art</h3>
<p>All 8 items at 48px (3×); in-app they render 36px in cards and 64px on Bracket Climb. Sources: Silver Blade = pack sword r8c10, Bronze Shield = pack heater r8c6 + bronze ramp; Cloth Purse, Ledger Tome, Copper Compass, Silver Charm, Gold Gauntlet, Golden Crown are hand-built to the bible (programmatic construction: dilated outline, per-plate light source, gem/rivet details). Locked items keep the silhouette rendered in <code>off #4B5A56</code>.</p>
<div class="cards">${cards}</div>
` + h.slice(end);

fs.writeFileSync('Savborne-handoff.html', h);
console.log('item gallery rebuilt:', names.length, 'cards; intro synced');
