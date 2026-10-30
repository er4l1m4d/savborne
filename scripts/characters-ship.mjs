// Ship the character batch into Savborne-handoff.html.
//   --plan   print the slot table (owner, aria-label, wrapper size, old art census)
//   default  apply: swap every screen sprite, square the wrappers, rebuild the gallery
//
// The old sprite art is 16x24 and the new art is pack-native 16x16, and .spr is
// position:absolute;width:100%;height:100% — so the WRAPPER governs the render. Leaving a
// 2:3 wrapper around a 1:1 viewBox would letterbox and float the character off the floor,
// which is why every wrapper gets squared to its own width here.
import fs from 'node:fs';

const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
let h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const PLAN = process.argv.includes('--plan');

// Which sprite each slot shows, keyed by the slot's own aria-label. Kemi carries the Silver
// Blade on Home and in battles, so she is Silver gear; Welcome and Name are a brand-new
// player, so Entry. Tobi is a human opponent — he gets a DIFFERENT gear from Kemi so the two
// fighters stay tellable apart in an arena mock, and never a roster rival.
// Rival labels are matched on the new names too, so re-running this shipper is a no-op
// rather than a re-assignment of the rival back to a hero sprite.
const RIVAL_NAMES = ['Savborne AI', 'Mint Wraith', 'Hollow Ghost', 'Hooded Miser', 'Cutpurse'];
const assign = (owner, label) => {
  if (RIVAL_NAMES.some((n) => label.includes(n))) return 'Rival · Mint Wraith';
  if (label.includes('Tobi')) return 'Hero · Gold';
  if (owner === 'A_Welcome' || owner === 'A_Name') return 'Hero · Entry';
  return 'Hero · Silver';
};

const owners = [...h.matchAll(/<(?:section|figure|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => (owners.filter((o) => o.at < idx).pop() || { id: '(none)' }).id;
const galleryStart = h.indexOf('<h3>Character sprites</h3>');
const galleryEnd = h.indexOf('<h3>Item art</h3>', galleryStart);

const slots = [];
for (const m of h.matchAll(/<svg\b[^>]*class="spr"[^>]*>/g)) {
  const at = m.index;
  const el = h.slice(at, h.indexOf('</svg>', at) + 6);
  const wrapStart = h.lastIndexOf('<div', at);
  const wrap = h.slice(wrapStart, at);
  const label = (wrap.match(/aria-label="([^"]*)"/) || [, ''])[1];
  const wpx = (wrap.match(/width:\s*(\d+)px/) || [, ''])[1];
  const hpx = (wrap.match(/height:\s*(\d+)px/) || [, ''])[1];
  slots.push({
    at, el, wrapStart, label, wpx, hpx,
    owner: ownerAt(at),
    inGallery: at > galleryStart && at < galleryEnd,
    colors: [...new Set((el.match(/fill="[^"]+"/g) || []))].map((s) => s.slice(6, -1)),
  });
}

const screen = slots.filter((s) => !s.inGallery);
console.log(`${slots.length} .spr slots — ${screen.length} on screens, ${slots.length - screen.length} in the gallery\n`);
for (const s of slots) {
  const tag = s.inGallery ? 'GALLERY' : assign(s.owner, s.label);
  console.log(`${s.inGallery ? 'gal ' : 'scr '} ${s.owner.padEnd(15)} "${s.label}"  ${s.wpx || '-'}x${s.hpx || '-'}  -> ${tag}`);
  if (PLAN) console.log(`      old art colours: ${s.colors.join(' ')}`);
}
if (PLAN) process.exit(0);

// ---- apply: screen slots first (the gallery is rebuilt wholesale afterwards) ----
let swapped = 0, squared = 0;
for (const s of slots.filter((x) => !x.inGallery).reverse()) {
  const key = assign(s.owner, s.label);
  const paths = ART[key];
  if (!paths) throw new Error(`no art for ${key}`);
  const px = s.wpx || '96';
  const old = s.el;
  // Rebuild the element outright. Splicing with a greedy /[\s\S]*/ replace eats the
  // closing </svg> along with the old paths, which unbalances the document.
  const next = `<svg class="spr" width="${px}" height="${px}" shape-rendering="crispEdges" viewBox="0 0 16 16">` + paths + '</svg>';
  if (next === old) throw new Error(`swap produced no change at ${s.owner}`);
  h = h.slice(0, s.at) + next + h.slice(s.at + old.length);
  swapped++;
  // One pass over the wrapper: it sits entirely before the svg we just replaced, so the
  // indices are still valid — but both edits must happen together, because the first one
  // changes the wrapper's length and would stale the offset the second one writes at.
  const wrapOld = h.slice(s.wrapStart, s.at);
  let wrapNew = wrapOld;
  let did = null;
  if (s.wpx && s.hpx && s.wpx !== s.hpx) {
    const sq = wrapOld.replace(/height:\s*\d+px/, `height: ${s.wpx}px`);
    if (sq !== wrapOld) { wrapNew = sq; did = 'squared'; squared++; }
  }
  if (s.label.includes('Savborne AI')) {
    const rn = wrapNew.replace(/aria-label="[^"]*"/, `aria-label="Opponent: ${key.replace('Rival · ', '')} (one of four rolled per battle)"`);
    if (rn !== wrapNew) { wrapNew = rn; did = did ? 'squared+renamed' : 'renamed'; }
  }
  if (did) h = h.slice(0, s.wrapStart) + wrapNew + h.slice(s.at);
}

// ---- rebuild the gallery to the icon-set card pattern ----
const KEYS = [
  'Hero · Entry', 'Hero · Bronze', 'Hero · Silver', 'Hero · Gold',
  'Heroine · Entry', 'Heroine · Bronze', 'Heroine · Silver', 'Heroine · Gold',
  'Rival · Mint Wraith', 'Rival · Hollow Ghost', 'Rival · Hooded Miser', 'Rival · Cutpurse',
];
const cards = KEYS.map((k) => `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px"><svg width="96" height="96" viewBox="0 0 16 16" role="img" aria-label="${k}" style="image-rendering:pixelated">${ART[k]}</svg><code>${k}</code></div>`).join('');
const gStart = h.indexOf('<h3>Character sprites</h3>');
const gEnd = h.indexOf('<h3>Item art</h3>', gStart);
h = h.slice(0, gStart) + `<h3>Character sprites</h3>
<p>All character art is pack-native: one Tiny Dungeon tile per sprite at <b>16×16</b>, shown here at 6×. The hero has <b>4 bracket gears</b> (Entry cloth, Bronze plate, Silver steel, Gold gilt via the declared gilt map). The heroine shares every gear body pixel-for-pixel — her head is tile r8c3 clipped to the hero's own outline columns, so only the head differs and the armour never does; the two closed-helm gears keep the helm verbatim and gain four hair pixels under the rim. The AI opponent is <b>rolled from a roster of four</b> rivals per battle, each with its own name; a friend battle always shows a human gear sprite instead.</p>
<p>Idle is a 1px two-frame bob in CSS (<code>steps(2)</code>). There are <b>no drawn attack frames</b> — turn-reveal and lunge are transform animations (translate + brief scale) on the same single-pose sprite, which keeps the pack-native rule and costs no extra art.</p>
<div class="cards">${cards}</div>
` + h.slice(gEnd);

const open = (h.match(/<svg\b/g) || []).length;
const close = (h.match(/<\/svg>/g) || []).length;
if (open !== close) throw new Error(`svg tag mismatch after ship: ${open} open vs ${close} close — refusing to write`);
fs.writeFileSync('Savborne-handoff.html', h);
console.log(`\nswapped ${swapped} screen sprites, squared ${squared} wrappers, gallery rebuilt with ${KEYS.length} cards`);
console.log(`svg tags balanced: ${open} open / ${close} close`);
